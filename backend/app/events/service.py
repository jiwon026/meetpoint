from dataclasses import dataclass
from datetime import date

from app.cache import CONTENT_TTL, VENUE_TTL, ContentCacheRepo
from app.events.kopis import KopisClient
from app.events.seoul import SeoulEventClient
from app.geo import haversine_km
from app.models import Hub

EVENT_RADIUS_KM = 1.5
SEOUL_RAW_KEY = "events:seoul:raw"


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
        id=f"seoul:{row.get('TITLE', '')}:{_date_part(row.get('STRTDATE', ''))}",
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
    rows = client.fetch_all()
    cache.set(SEOUL_RAW_KEY, rows, kind="event")
    return rows


def get_seoul_events(
    hub: Hub, meet_date: date, client: SeoulEventClient, cache: ContentCacheRepo
) -> list[Event]:
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
    return sorted(events, key=lambda e: e.distance_m)


KOPIS_AREA_BY_REGION = {"경기": "41", "인천": "28"}


def _kopis_dot_date(value: str) -> str:
    return value.replace(".", "-")


def _venue_coords(mt10id: str, client: KopisClient, cache: ContentCacheRepo) -> tuple[float, float] | None:
    if not mt10id:
        return None
    key = f"venue:kopis:{mt10id}"
    cached = cache.get(key, VENUE_TTL)
    if cached is None:
        facility = client.facility(mt10id)
        cached = {"la": facility.get("la", ""), "lo": facility.get("lo", "")}
        cache.set(key, cached, kind="venue")
    try:
        lat, lng = float(cached["la"]), float(cached["lo"])
    except (TypeError, ValueError, KeyError):
        return None
    if lat == 0 or lng == 0:
        return None
    return lat, lng


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
    events: list[Event] = []
    for row in rows:
        coords = _venue_coords(row.get("mt10id", ""), client, cache)
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
