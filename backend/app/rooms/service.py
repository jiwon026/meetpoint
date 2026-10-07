import logging
from collections.abc import Sequence
from dataclasses import asdict
from datetime import date, datetime, timedelta

import httpx
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.attributes import set_committed_value
from sqlalchemy.orm import Session

from app.cache import utcnow
from app.clock import kst_date
from app.errors import UpstreamError
from app.options import REGIONS, THEME_OFF, THEMES
from app.geo import is_in_metro, round_coord
from app.geocoding.kakao import Geocoder
from app.geocoding.nearest import StationWalk, nearest_stations
from app.hubs import hub_lines, load_hub_candidates
from app.models import Hub, Participant, Room, Station
from app.ranking.rank import HubScore, ParticipantInput, rank_with_preference
from app.rooms.slug import generate_slug
from app.schemas import (
    LegOut,
    ParticipantCreate,
    ParticipantOut,
    RecommendationOut,
    ResultOut,
    RoomCreate,
    RoomOut,
)
from app.stations import all_stations
from app.stats import bump
from app.transit.matrix import StationTimeMatrix

logger = logging.getLogger(__name__)

ROOM_KEEP_DAYS = 7
SLUG_RETRIES = 5
MAX_PARTICIPANTS = 20
# 프론트엔드 lib/constants.ts에 같은 값이 있다. 바꾸면 둘 다.
MAX_MEET_DAYS_AHEAD = 365

MSG_ADDRESS_NOT_FOUND = "주소를 찾지 못했어요. 역을 직접 골라주세요."
MSG_OUTSIDE_METRO = "아직 수도권만 지원해요"
MSG_EXPIRED = "약속이 지난 방이에요"
MSG_ROOM_NOT_FOUND = "방을 찾을 수 없어요"
MSG_STATION_NOT_FOUND = "역을 찾을 수 없어요"
MSG_ROOM_FULL = "참여 인원이 가득 찼어요 (최대 20명)"
MSG_PARTICIPANT_NOT_FOUND = "참여자를 찾을 수 없어요"
MSG_DATE_PAST = "오늘 이후 날짜를 골라주세요"
MSG_DATE_TOO_FAR = "약속 날짜는 1년 안으로 골라주세요"


def _unique_slug(session: Session) -> str:
    for _ in range(SLUG_RETRIES):
        slug = generate_slug()
        if session.scalar(select(Room.id).where(Room.slug == slug)) is None:
            return slug
    return generate_slug(8)


def _check_meet_date(meet_date: date, now: datetime) -> None:
    # 먼 미래 날짜를 받으면 "약속 7일 뒤 삭제"가 사실상 무기한 보관이 된다.
    today = kst_date(now)
    if meet_date < today:
        raise HTTPException(status_code=422, detail=MSG_DATE_PAST)
    if meet_date > today + timedelta(days=MAX_MEET_DAYS_AHEAD):
        raise HTTPException(status_code=422, detail=MSG_DATE_TOO_FAR)


def create_room(session: Session, data: RoomCreate) -> Room:
    now = utcnow()
    _check_meet_date(data.meet_date, now)
    expires = datetime.combine(data.meet_date, datetime.min.time()) + timedelta(days=ROOM_KEEP_DAYS)
    themes = data.chosen_themes()
    room = Room(
        slug=_unique_slug(session),
        title=data.title.strip(),
        meet_date=data.meet_date,
        created_at=now,
        expires_at=expires,
        regions=list(data.regions),
        theme=themes[0] if themes else None,
        themes=themes,
    )
    session.add(room)
    session.commit()
    session.refresh(room)
    bump(session, "rooms_created", now)
    return room


def get_room(session: Session, slug: str) -> Room:
    room = session.scalar(select(Room).where(Room.slug == slug))
    if room is None:
        raise HTTPException(status_code=404, detail=MSG_ROOM_NOT_FOUND)
    if room.expires_at < utcnow():
        raise HTTPException(status_code=410, detail=MSG_EXPIRED)
    return room


def _resolve_point(session: Session, data: ParticipantCreate, geocoder: Geocoder) -> tuple[float, float]:
    if data.station_id is not None:
        station = session.get(Station, data.station_id)
        if station is None:
            raise HTTPException(status_code=404, detail=MSG_STATION_NOT_FOUND)
        return station.lat, station.lng
    try:
        point = geocoder.geocode(data.address or "")
    except (httpx.HTTPError, UpstreamError) as exc:
        logger.warning("geocode failed error=%s", type(exc).__name__)
        raise HTTPException(status_code=503, detail=MSG_ADDRESS_NOT_FOUND) from exc
    if point is None:
        raise HTTPException(status_code=422, detail=MSG_ADDRESS_NOT_FOUND)
    return point.lat, point.lng


def add_participant(
    session: Session, room: Room, data: ParticipantCreate, geocoder: Geocoder
) -> Participant:
    # 지오코딩 전에 막는다. 정원은 빠진 사람을 포함한 전체 행 수로 센다 (빼기를 반복해 행이 늘지 않게).
    if len(room.participants) >= MAX_PARTICIPANTS:
        raise HTTPException(status_code=422, detail=MSG_ROOM_FULL)
    lat, lng = _resolve_point(session, data, geocoder)
    if not is_in_metro(lat, lng):
        raise HTTPException(status_code=422, detail=MSG_OUTSIDE_METRO)
    nearest = nearest_stations(lat, lng, all_stations(session))
    participant = Participant(
        room_id=room.id,
        nickname=data.nickname.strip(),
        lat=round_coord(lat),
        lng=round_coord(lng),
        nearest_stations=[asdict(n) for n in nearest],
        active=True,
        created_at=utcnow(),
    )
    session.add(participant)
    session.commit()
    session.refresh(participant)
    session.refresh(room)
    bump(session, "participants_added", participant.created_at)
    return participant


def set_participant_active(session: Session, room: Room, participant_id: int, active: bool) -> Participant:
    participant = session.get(Participant, participant_id)
    if participant is None or participant.room_id != room.id:
        raise HTTPException(status_code=404, detail=MSG_PARTICIPANT_NOT_FOUND)
    participant.active = active
    session.commit()
    session.refresh(participant)
    session.refresh(room)
    return participant


def participant_out(p: Participant) -> ParticipantOut:
    first = p.nearest_stations[0] if p.nearest_stations else {"station_name": "", "via": "walk"}
    return ParticipantOut(
        id=p.id, nickname=p.nickname, nearest_station_name=first["station_name"],
        via=first["via"], active=p.active,
    )


def room_themes(room: Room) -> list[str]:
    """방이 고른 테마. themes 열을 더하기 전에 만든 방은 theme 하나를 읽는다."""
    if room.themes is not None:
        return [t for t in THEMES if t in room.themes]
    return [room.theme] if room.theme else []


def _first(themes: Sequence[str]) -> str | None:
    return themes[0] if themes else None


def room_out(room: Room) -> RoomOut:
    themes = room_themes(room)
    return RoomOut(
        slug=room.slug,
        title=room.title,
        meet_date=room.meet_date,
        expires_at=room.expires_at,
        regions=list(room.regions),
        theme=_first(themes),
        themes=themes,
        participants=[participant_out(p) for p in room.participants],
    )


def _applied_themes(room: Room, themes: Sequence[str] | None) -> list[str]:
    """쿼리가 방의 기본값보다 우선한다. 쿼리에 any가 있으면 테마를 쓰지 않는다."""
    if themes is None:
        return room_themes(room)
    if THEME_OFF in themes:
        return []
    return [t for t in THEMES if t in themes]


def _recommendation(
    score: HubScore, hub: Hub, lines: list[str], theme_match: bool, station_by_id: dict[int, Station]
) -> RecommendationOut:
    return RecommendationOut(
        hub_id=score.hub_id,
        name=score.name,
        region=hub.region,
        tags=list(hub.tags),
        vibe_summary=hub.vibe_summary,
        lat=hub.lat,
        lng=hub.lng,
        max_minutes=score.max_minutes,
        spread_minutes=score.spread_minutes,
        lines=lines,
        theme_match=theme_match,
        legs=[
            LegOut(
                participant_id=l.participant_id,
                nickname=l.nickname,
                minutes=l.leg.total_minutes,
                origin_station_name=l.leg.origin_station_name,
                origin_lat=getattr(station_by_id.get(l.leg.origin_station_id), "lat", None),
                origin_lng=getattr(station_by_id.get(l.leg.origin_station_id), "lng", None),
                via=l.leg.via,
            )
            for l in score.legs
        ],
    )


def _mark_first_result(session: Session, room: Room) -> None:
    """추천이 처음 나온 방을 한 번만 센다. 폴링과 동시 요청에도 방당 한 번이다."""
    if room.first_result_at is not None:
        return
    now = utcnow()
    try:
        claimed = session.execute(
            update(Room)
            .where(Room.id == room.id, Room.first_result_at.is_(None))
            .values(first_result_at=now)
            .execution_options(synchronize_session=False)
        ).rowcount
        session.commit()
    except SQLAlchemyError as exc:
        session.rollback()
        logger.warning("first result mark failed error=%s", type(exc).__name__)
        return
    if claimed == 1:
        # 다시 조회하지 않고 읽어 둔 값만 맞춘다. 조회가 실패해 이미 만든 응답을 잃지 않게.
        set_committed_value(room, "first_result_at", now)
        bump(session, "rooms_with_result", now)


def compute_result(
    session: Session,
    room: Room,
    matrix: StationTimeMatrix,
    regions: Sequence[str] | None = None,
    themes: Sequence[str] | None = None,
) -> ResultOut:
    applied_regions = [r for r in REGIONS if r in (regions or room.regions)]
    applied_themes = _applied_themes(room, themes)
    present = [p for p in room.participants if p.active]
    if len(present) < 2:
        return ResultOut(
            status="waiting", recommendations=[], best_max_minutes=None,
            regions=applied_regions, theme=_first(applied_themes), themes=applied_themes,
        )
    inputs = [
        ParticipantInput(p.id, p.nickname, tuple(StationWalk(**d) for d in p.nearest_stations))
        for p in present
    ]
    stations = all_stations(session)
    hubs, candidates = load_hub_candidates(session, stations)
    hub_by_id = {h.id: h for h in hubs}
    # 상위 5곳을 자르기 전에 지역으로 거른다. 자른 뒤 거르면 결과가 비어 보인다.
    in_region = [c for c in candidates if hub_by_id[c.hub_id].region in applied_regions]
    # 고른 테마 중 하나라도 맞으면 테마에 맞는 거점이다.
    matching = frozenset(
        c.hub_id for c in in_region
        if any(t in hub_by_id[c.hub_id].themes for t in applied_themes)
    )
    ranking = rank_with_preference(inputs, in_region, matrix, preferred_hub_ids=matching)
    lines = hub_lines(hubs, stations)
    station_by_id = {s.id: s for s in stations}
    result = ResultOut(
        status="ready",
        recommendations=[
            _recommendation(s, hub_by_id[s.hub_id], lines[s.hub_id], s.hub_id in matching, station_by_id)
            for s in ranking.scores
        ],
        best_max_minutes=ranking.best_max_minutes,
        regions=applied_regions,
        theme=_first(applied_themes),
        themes=applied_themes,
    )
    # 응답을 다 만든 뒤에 표시한다. 통계 기록이 실패해도 응답은 그대로 나간다.
    _mark_first_result(session, room)
    return result
