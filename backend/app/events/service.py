import logging
from dataclasses import asdict, dataclass
from datetime import date

import httpx

from app.cache import CONTENT_TTL, ContentCacheRepo
from app.errors import UpstreamError
from app.events.seoul import SeoulEventClient
from app.geo import haversine_km
from app.models import Hub

logger = logging.getLogger(__name__)

EVENT_RADIUS_KM = 1.5
SEOUL_RAW_KEY = "events:seoul:raw"
# 원본 행에는 쓰지 않는 필드가 많다. 캐시에는 쓰는 것만 담는다.
SEOUL_KEEP_FIELDS = (
    "CODENAME",
    "TITLE",
    "PLACE",
    "STRTDATE",
    "END_DATE",
    "LOT",
    "LAT",
    "ORG_LINK",
    "MAIN_IMG",
    "IS_FREE",
)


@dataclass(frozen=True)
class Event:
    id: str
    title: str
    place: str
    start_date: str  # YYYY-MM-DD
    end_date: str
    lat: float
    lng: float
    url: str
    image: str
    category: str
    is_free: bool
    distance_m: int


def _parse_coords(row: dict) -> tuple[float, float] | None:
    try:
        lat = float(row.get("LAT") or 0)
        lng = float(row.get("LOT") or 0)
    except ValueError:
        return None
    if lat == 0 or lng == 0:
        return None
    # 서울시 데이터는 LAT와 LOT가 뒤바뀐 행이 섞여 있다. 위도는 100을 넘을 수 없다.
    if lat > 100:
        lat, lng = lng, lat
    return lat, lng


def _date_part(value: str) -> str:
    return value[:10]


def _to_event(row: dict, hub: Hub, coords: tuple[float, float]) -> Event:
    lat, lng = coords
    distance_m = int(haversine_km(hub.lat, hub.lng, lat, lng) * 1000)
    return Event(
        id=f"seoul:{row.get('TITLE', '')}:{row.get('PLACE', '')}:{_date_part(row.get('STRTDATE', ''))}",
        title=row.get("TITLE", ""),
        place=row.get("PLACE", ""),
        start_date=_date_part(row.get("STRTDATE", "")),
        end_date=_date_part(row.get("END_DATE", "")),
        lat=lat,
        lng=lng,
        url=row.get("ORG_LINK", "") or "",
        image=row.get("MAIN_IMG", "") or "",
        category=row.get("CODENAME", ""),
        is_free=(row.get("IS_FREE") == "무료"),
        distance_m=distance_m,
    )


def _open_on(row: dict, meet_date: date) -> bool:
    start = _date_part(row.get("STRTDATE", ""))
    end = _date_part(row.get("END_DATE", ""))
    target = meet_date.isoformat()
    return bool(start) and bool(end) and start <= target <= end


def _seoul_raw(client: SeoulEventClient, cache: ContentCacheRepo) -> list[dict]:
    cached = cache.get(SEOUL_RAW_KEY, CONTENT_TTL)
    if cached is not None:
        return list(cached)
    # 여러 쪽을 받는 동안 DB 연결을 붙잡지 않는다.
    cache.release()
    try:
        rows = client.fetch_all()
    except (httpx.HTTPError, UpstreamError) as exc:
        stale = cache.get_stale(SEOUL_RAW_KEY)
        if stale is None:
            raise
        # 설계 8절: 갱신에 실패하면 캐시된 값을 쓴다. 호출자에게는 알리지 않고 로그만 남긴다.
        logger.warning("seoul feed refresh failed, serving stale error=%s", type(exc).__name__)
        return list(stale)
    trimmed = [{k: r.get(k, "") for k in SEOUL_KEEP_FIELDS} for r in rows]
    cache.set(SEOUL_RAW_KEY, trimmed, kind="event")
    return trimmed


def get_seoul_events(
    hub: Hub, meet_date: date, client: SeoulEventClient, cache: ContentCacheRepo
) -> list[Event]:
    key = f"events:seoul:{hub.id}:{meet_date.isoformat()}"
    cached = cache.get(key, CONTENT_TTL)
    if cached is not None:
        return [Event(**e) for e in cached]
    events: list[Event] = []
    for row in _seoul_raw(client, cache):
        if not _open_on(row, meet_date):
            continue
        coords = _parse_coords(row)
        if coords is None:
            continue
        if haversine_km(hub.lat, hub.lng, *coords) > EVENT_RADIUS_KM:
            continue
        events.append(_to_event(row, hub, coords))
    events = sorted(events, key=lambda e: e.distance_m)
    cache.set(key, [asdict(e) for e in events], kind="event", hub_id=hub.id)
    return events


def get_events(
    hub: Hub,
    meet_date: date,
    seoul_client: SeoulEventClient,
    cache: ContentCacheRepo,
) -> list[Event]:
    # 서울시 API는 서울 행사만 준다. 경기, 인천 공연(KOPIS)은 방을 서울로만 만들게 된 뒤 쓰이지 않아 뺐다(2026-11-10).
    if hub.region != "서울":
        return []
    return get_seoul_events(hub, meet_date, seoul_client, cache)
