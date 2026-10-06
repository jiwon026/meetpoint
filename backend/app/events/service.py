import hashlib
import logging
import time
from dataclasses import asdict, dataclass
from datetime import date

import httpx

from app.cache import CONTENT_TTL, VENUE_TTL, ContentCacheRepo
from app.errors import UpstreamError
from app.events.kopis import KopisClient
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


KOPIS_AREA_BY_REGION = {"경기": "41", "인천": "28"}


def _kopis_dot_date(value: str) -> str:
    return value.replace(".", "-")


# 한 요청에서 새로 찾는 공연장 수의 상한. 공연장 하나에 KOPIS 호출이 두 번(상세, 시설) 든다.
# 남은 공연장은 다음 요청이나 scripts.warm_kopis_venues가 이어서 채운다.
MAX_NEW_VENUE_LOOKUPS = 10


def venue_cache_key(area: str, name: str) -> str:
    # 공연장 이름은 길 수 있고 캐시 키 열은 120자다. 이름 대신 해시를 쓴다.
    digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:20]
    return f"venue:kopis:{area}:{digest}"


def _coords_from(cached: dict) -> tuple[float, float] | None:
    try:
        lat, lng = float(cached["la"]), float(cached["lo"])
    except (TypeError, ValueError, KeyError):
        return None
    if lat == 0 or lng == 0:
        return None
    return lat, lng


def _look_up_venue(mt20id: str, client: KopisClient) -> dict[str, str]:
    """공연 하나를 실마리로 그 공연장의 좌표를 구한다. id나 좌표가 없으면 빈 값을 돌려준다."""
    mt10id = client.performance_facility_id(mt20id)
    facility = client.facility(mt10id) if mt10id else {}
    return {"la": facility.get("la", ""), "lo": facility.get("lo", "")}


def resolve_venues(
    area: str,
    rows: list[dict],
    client: KopisClient,
    cache: ContentCacheRepo,
    limit: int,
    pause_seconds: float = 0.0,
) -> tuple[dict[str, tuple[float, float] | None], int]:
    """공연장 이름별 좌표와, 이번에 새로 찾은 공연장 수를 돌려준다.

    캐시에 없는 공연장은 limit곳까지만 KOPIS에서 찾는다. 못 찾아본 이름은 결과에 넣지 않는다.
    좌표가 없는 공연장도 캐시에 남겨 다시 찾지 않는다. 조회가 실패하면 예외가 올라가고 캐시하지 않는다.
    """
    coords: dict[str, tuple[float, float] | None] = {}
    deferred: set[str] = set()
    looked_up = 0
    for row in rows:
        name = row.get("fcltynm", "")
        if not name or name in coords or name in deferred:
            continue
        key = venue_cache_key(area, name)
        cached = cache.get(key, VENUE_TTL)
        if cached is None:
            if looked_up >= limit:
                deferred.add(name)
                continue
            if looked_up and pause_seconds:
                time.sleep(pause_seconds)
            cached = _look_up_venue(row.get("mt20id", ""), client)
            cache.set(key, cached, kind="venue")
            looked_up += 1
        coords[name] = _coords_from(cached)
    return coords, looked_up


def get_kopis_events(
    hub: Hub, meet_date: date, client: KopisClient, cache: ContentCacheRepo
) -> list[Event]:
    area = KOPIS_AREA_BY_REGION.get(hub.region)
    if area is None:
        return []
    key = f"events:kopis:{area}:{meet_date.isoformat()}"
    rows = cache.get(key, CONTENT_TTL)
    if rows is None:
        rows = client.list_performances(meet_date, area)
        cache.set(key, rows, kind="event")
    venues, _ = resolve_venues(area, rows, client, cache, limit=MAX_NEW_VENUE_LOOKUPS)
    events: list[Event] = []
    for row in rows:
        coords = venues.get(row.get("fcltynm", ""))
        if coords is None:
            continue
        km = haversine_km(hub.lat, hub.lng, *coords)
        if km > EVENT_RADIUS_KM:
            continue
        mt20id = row.get("mt20id", "")
        events.append(
            Event(
                id=f"kopis:{mt20id}",
                title=row.get("prfnm", ""),
                place=row.get("fcltynm", ""),
                start_date=_kopis_dot_date(row.get("prfpdfrom", "")),
                end_date=_kopis_dot_date(row.get("prfpdto", "")),
                lat=coords[0],
                lng=coords[1],
                url=f"https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?mt20Id={mt20id}",
                image=row.get("poster", ""),
                category=row.get("genrenm", ""),
                is_free=False,
                distance_m=int(km * 1000),
            )
        )
    return sorted(events, key=lambda e: e.distance_m)


def get_events(
    hub: Hub,
    meet_date: date,
    seoul_client: SeoulEventClient,
    kopis_client: KopisClient,
    cache: ContentCacheRepo,
) -> list[Event]:
    if hub.region == "서울":
        return get_seoul_events(hub, meet_date, seoul_client, cache)
    return get_kopis_events(hub, meet_date, kopis_client, cache)
