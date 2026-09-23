from dataclasses import asdict, dataclass

from app.cache import CONTENT_TTL, ContentCacheRepo
from app.models import Hub
from app.places.kakao_local import KakaoLocalClient

PLACE_RADIUS_M = 600
CATEGORY_CODES = {"food": "FD6", "cafe": "CE7"}
PLAY_KEYWORDS = ("방탈출", "보드게임카페", "노래방", "볼링장", "만화카페")


@dataclass(frozen=True)
class Place:
    id: str
    name: str
    category: str
    address: str
    distance_m: int
    url: str
    lat: float
    lng: float


def _to_place(doc: dict) -> Place:
    category = doc.get("category_name", "").split(">")[-1].strip()
    address = doc.get("road_address_name") or doc.get("address_name") or ""
    return Place(
        id=str(doc["id"]),
        name=doc["place_name"],
        category=category,
        address=address,
        distance_m=int(doc.get("distance") or 0),
        url=doc.get("place_url", ""),
        lat=float(doc["y"]),
        lng=float(doc["x"]),
    )


def _fetch(hub: Hub, kind: str, client: KakaoLocalClient) -> list[Place]:
    if kind in CATEGORY_CODES:
        docs = client.category_search(CATEGORY_CODES[kind], hub.lat, hub.lng, radius=PLACE_RADIUS_M)
        return [_to_place(d) for d in docs]
    if kind == "play":
        seen: dict[str, Place] = {}
        for keyword in PLAY_KEYWORDS:
            for doc in client.keyword_search(keyword, hub.lat, hub.lng, radius=PLACE_RADIUS_M):
                place = _to_place(doc)
                seen.setdefault(place.id, place)
        return sorted(seen.values(), key=lambda p: p.distance_m)
    raise ValueError(f"unknown place kind: {kind}")


def get_places(hub: Hub, kind: str, client: KakaoLocalClient, cache: ContentCacheRepo) -> list[Place]:
    key = f"places:{hub.id}:{kind}"
    cached = cache.get(key, CONTENT_TTL)
    if cached is not None:
        return [Place(**item) for item in cached]
    places = _fetch(hub, kind, client)
    cache.set(key, [asdict(p) for p in places], kind=kind, hub_id=hub.id)
    return places
