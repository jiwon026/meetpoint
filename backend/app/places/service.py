from dataclasses import asdict, dataclass
from typing import Literal

from app.cache import CONTENT_TTL, ContentCacheRepo
from app.models import Hub
from app.places.kakao_local import KakaoLocalClient

PLACE_RADIUS_M = 600
CATEGORY_CODES = {"food": "FD6", "cafe": "CE7"}
PLACE_LIMIT = 15
PAGE_SIZE = 15
# 카페는 걸러내는 가게가 있어 목록이 찰 때까지 다음 쪽을 읽는다.
MAX_PAGES = 3

PlaceSort = Literal["recommended", "distance"]
# "추천순"은 카카오의 정확도순이다. 별점이나 리뷰 수가 아니라 카카오가 매긴 순서라서 인기순이라고 부르지 않는다.
# 가까운 순은 역 안의 매점과 프랜차이즈가 앞에 온다 (강남역 반경 600m에 음식점이 약 1,000곳).
KAKAO_SORT: dict[str, str] = {"recommended": "accuracy", "distance": "distance"}
# 카카오의 카페 분류(CE7)에는 만화카페, 보드카페, 키즈카페, 모임 공간이 섞여 있다.
# 이들은 분류 이름이 "음식점 > 카페"로 시작하지 않는다. 놀거리 탭이 따로 보여준다.
CAFE_CATEGORY_PREFIX = "음식점>카페"
# 세부 종류가 붙지 않은 테마카페는 방탈출, 공방, 힐링카페 같은 체험 공간이 대부분이라 뺀다.
# 디저트카페, 북카페처럼 세부 종류가 있는 테마카페는 남긴다.
CAFE_EXCLUDED_CATEGORIES = frozenset({"음식점>카페>테마카페"})
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


def _is_cafe(doc: dict) -> bool:
    category = doc.get("category_name", "").replace(" ", "")
    return category.startswith(CAFE_CATEGORY_PREFIX) and category not in CAFE_EXCLUDED_CATEGORIES


def _fetch_category(hub: Hub, kind: str, client: KakaoLocalClient, sort: PlaceSort) -> list[Place]:
    places: list[Place] = []
    for page in range(1, MAX_PAGES + 1):
        docs = client.category_search(
            CATEGORY_CODES[kind], hub.lat, hub.lng, radius=PLACE_RADIUS_M, size=PAGE_SIZE, sort=KAKAO_SORT[sort], page=page
        )
        places.extend(_to_place(d) for d in docs if kind != "cafe" or _is_cafe(d))
        if len(places) >= PLACE_LIMIT or len(docs) < PAGE_SIZE:
            break
    return places[:PLACE_LIMIT]


def _fetch(hub: Hub, kind: str, client: KakaoLocalClient, sort: PlaceSort) -> list[Place]:
    if kind in CATEGORY_CODES:
        return _fetch_category(hub, kind, client, sort)
    if kind == "play":
        # 검색어 여러 개를 합친 목록이라 카카오의 순서가 의미가 없다. 늘 가까운 순이다.
        seen: dict[str, Place] = {}
        for keyword in PLAY_KEYWORDS:
            for doc in client.keyword_search(keyword, hub.lat, hub.lng, radius=PLACE_RADIUS_M):
                place = _to_place(doc)
                seen.setdefault(place.id, place)
        return sorted(seen.values(), key=lambda p: p.distance_m)
    raise ValueError(f"unknown place kind: {kind}")


def place_cache_key(hub_id: int, kind: str, sort: PlaceSort = "recommended") -> str:
    if kind in CATEGORY_CODES:
        return f"places:{hub_id}:{kind}:{sort}"
    return f"places:{hub_id}:{kind}"


def get_places(
    hub: Hub, kind: str, client: KakaoLocalClient, cache: ContentCacheRepo, sort: PlaceSort = "recommended"
) -> list[Place]:
    key = place_cache_key(hub.id, kind, sort)
    cached = cache.get(key, CONTENT_TTL)
    if cached is not None:
        return [Place(**item) for item in cached]
    places = _fetch(hub, kind, client, sort)
    cache.set(key, [asdict(p) for p in places], kind=kind, hub_id=hub.id)
    return places
