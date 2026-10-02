import logging
from dataclasses import asdict
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.cache import ContentCacheRepo
from app.db import get_db
from app.deps import get_cache, get_geocoder, get_kopis_client, get_local_client, get_matrix, get_seoul_client
from app.errors import UpstreamError
from app.events.kopis import KopisClient
from app.events.seoul import SeoulEventClient
from app.events.service import get_events
from app.geocoding.kakao import Geocoder
from app.models import Hub
from app.options import Region, Theme
from app.places.kakao_local import KakaoLocalClient
from app.places.service import get_places, place_cache_key
from app.rooms import service
from app.schemas import (
    ContentOut,
    ParticipantCreate,
    ParticipantOut,
    ResultOut,
    RoomCreate,
    RoomOut,
    StationOut,
)
from app.stations import search_stations
from app.transit.matrix import StationTimeMatrix

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/rooms", response_model=RoomOut, status_code=201)
def create_room(data: RoomCreate, db: Session = Depends(get_db)) -> RoomOut:
    return service.room_out(service.create_room(db, data))


@router.get("/rooms/{slug}", response_model=RoomOut)
def get_room(slug: str, db: Session = Depends(get_db)) -> RoomOut:
    return service.room_out(service.get_room(db, slug))


@router.post("/rooms/{slug}/participants", response_model=ParticipantOut, status_code=201)
def add_participant(
    slug: str,
    data: ParticipantCreate,
    db: Session = Depends(get_db),
    geocoder: Geocoder = Depends(get_geocoder),
) -> ParticipantOut:
    room = service.get_room(db, slug)
    return service.participant_out(service.add_participant(db, room, data, geocoder))


@router.get("/rooms/{slug}/result", response_model=ResultOut)
def get_result(
    slug: str,
    region: list[Region] | None = Query(default=None),
    theme: Theme | Literal["any"] | None = Query(default=None),
    db: Session = Depends(get_db),
    matrix: StationTimeMatrix = Depends(get_matrix),
) -> ResultOut:
    room = service.get_room(db, slug)
    return service.compute_result(db, room, matrix, regions=region, theme=theme)


@router.get("/stations", response_model=list[StationOut])
def stations(q: str = Query(default="", max_length=20), db: Session = Depends(get_db)) -> list[StationOut]:
    return [StationOut(id=s.id, name=s.name, line=s.line) for s in search_stations(db, q)]


MSG_CONTENT_UNAVAILABLE = "지금 불러올 수 없어요"
MSG_HUB_NOT_FOUND = "거점을 찾을 수 없어요"
ContentKind = Literal["food", "cafe", "play", "event"]


@router.get("/rooms/{slug}/hubs/{hub_id}/content", response_model=ContentOut)
def hub_content(
    slug: str,
    hub_id: int,
    kind: ContentKind,
    db: Session = Depends(get_db),
    local_client: KakaoLocalClient = Depends(get_local_client),
    seoul_client: SeoulEventClient = Depends(get_seoul_client),
    kopis_client: KopisClient = Depends(get_kopis_client),
    cache: ContentCacheRepo = Depends(get_cache),
) -> ContentOut:
    room = service.get_room(db, slug)
    hub = db.get(Hub, hub_id)
    if hub is None:
        raise HTTPException(status_code=404, detail=MSG_HUB_NOT_FOUND)
    try:
        if kind == "event":
            items = get_events(hub, room.meet_date, seoul_client, kopis_client, cache)
        else:
            items = get_places(hub, kind, local_client, cache)
        return ContentOut(kind=kind, items=[asdict(i) for i in items], error=None)
    except (httpx.HTTPError, UpstreamError) as exc:
        # 예외 클래스 이름만 남긴다. 요청 URL에는 API 키가 들어 있어 절대 기록하지 않는다.
        logger.warning("content fetch failed kind=%s hub=%s error=%s", kind, hub.id, type(exc).__name__)
        stale = cache.get_stale(place_cache_key(hub.id, kind)) if kind != "event" else None
        return ContentOut(kind=kind, items=list(stale or []), error=MSG_CONTENT_UNAVAILABLE)
