from dataclasses import asdict
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cache import utcnow
from app.geo import is_in_metro, round_coord
from app.geocoding.kakao import Geocoder
from app.geocoding.nearest import StationWalk, nearest_stations
from app.models import Hub, Participant, Room, Station
from app.ranking.rank import HubCandidate, ParticipantInput, rank_hubs
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
from app.transit.matrix import StationTimeMatrix

ROOM_KEEP_DAYS = 7
SLUG_RETRIES = 5

MSG_ADDRESS_NOT_FOUND = "주소를 찾지 못했어요. 역을 직접 골라주세요."
MSG_OUTSIDE_METRO = "아직 수도권만 지원해요"
MSG_EXPIRED = "약속이 지난 방이에요"
MSG_ROOM_NOT_FOUND = "방을 찾을 수 없어요"
MSG_STATION_NOT_FOUND = "역을 찾을 수 없어요"


def _unique_slug(session: Session) -> str:
    for _ in range(SLUG_RETRIES):
        slug = generate_slug()
        if session.scalar(select(Room.id).where(Room.slug == slug)) is None:
            return slug
    return generate_slug(8)


def create_room(session: Session, data: RoomCreate) -> Room:
    now = utcnow()
    expires = datetime.combine(data.meet_date, datetime.min.time()) + timedelta(days=ROOM_KEEP_DAYS)
    room = Room(
        slug=_unique_slug(session),
        title=data.title.strip(),
        meet_date=data.meet_date,
        created_at=now,
        expires_at=expires,
    )
    session.add(room)
    session.commit()
    session.refresh(room)
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
    point = geocoder.geocode(data.address or "")
    if point is None:
        raise HTTPException(status_code=422, detail=MSG_ADDRESS_NOT_FOUND)
    return point.lat, point.lng


def add_participant(
    session: Session, room: Room, data: ParticipantCreate, geocoder: Geocoder
) -> Participant:
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
        created_at=utcnow(),
    )
    session.add(participant)
    session.commit()
    session.refresh(participant)
    session.refresh(room)
    return participant


def participant_out(p: Participant) -> ParticipantOut:
    first = p.nearest_stations[0] if p.nearest_stations else {"station_name": "", "via": "walk"}
    return ParticipantOut(
        id=p.id, nickname=p.nickname, nearest_station_name=first["station_name"], via=first["via"]
    )


def room_out(room: Room) -> RoomOut:
    return RoomOut(
        slug=room.slug,
        title=room.title,
        meet_date=room.meet_date,
        expires_at=room.expires_at,
        participants=[participant_out(p) for p in room.participants],
    )


def _candidates(session: Session) -> tuple[list[Hub], list[HubCandidate]]:
    hubs = list(session.scalars(select(Hub).order_by(Hub.id)).all())
    nodes_by_name: dict[str, list[int]] = {}
    for s in all_stations(session):
        nodes_by_name.setdefault(s.name, []).append(s.id)
    candidates = [HubCandidate(h.id, h.name, tuple(nodes_by_name.get(h.name, ()))) for h in hubs]
    return hubs, candidates


def compute_result(session: Session, room: Room, matrix: StationTimeMatrix) -> ResultOut:
    if len(room.participants) < 2:
        return ResultOut(status="waiting", recommendations=[])
    inputs = [
        ParticipantInput(p.id, p.nickname, tuple(StationWalk(**d) for d in p.nearest_stations))
        for p in room.participants
    ]
    hubs, candidates = _candidates(session)
    hub_by_id = {h.id: h for h in hubs}
    scores = rank_hubs(inputs, candidates, matrix)
    recommendations = [
        RecommendationOut(
            hub_id=s.hub_id,
            name=s.name,
            region=hub_by_id[s.hub_id].region,
            tags=list(hub_by_id[s.hub_id].tags),
            vibe_summary=hub_by_id[s.hub_id].vibe_summary,
            lat=hub_by_id[s.hub_id].lat,
            lng=hub_by_id[s.hub_id].lng,
            max_minutes=s.max_minutes,
            spread_minutes=s.spread_minutes,
            legs=[
                LegOut(
                    participant_id=l.participant_id,
                    nickname=l.nickname,
                    minutes=l.leg.total_minutes,
                    origin_station_name=l.leg.origin_station_name,
                    via=l.leg.via,
                )
                for l in s.legs
            ],
        )
        for s in scores
    ]
    return ResultOut(status="ready", recommendations=recommendations)
