import json
from pathlib import Path

import httpx
import respx

from app.cache import ContentCacheRepo
from app.models import Hub
from app.places.kakao_local import KakaoLocalClient
from app.places.service import PLAY_KEYWORDS, Place, get_places

FIXTURES = Path(__file__).parent / "fixtures"
CATEGORY_URL = "https://dapi.kakao.com/v2/local/search/category.json"
KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@respx.mock
def test_food_maps_documents_to_places(seeded):
    route = respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json=_load("kakao_category_food.json")))
    hub = seeded.get(Hub, 1)
    places = get_places(hub, "food", KakaoLocalClient("k"), ContentCacheRepo(seeded))
    assert route.calls.last.request.url.params["category_group_code"] == "FD6"
    assert places[0] == Place(
        id="100",
        name="홍대 국밥집",
        category="국밥",
        address="서울 마포구 와우산로 1",
        distance_m=120,
        url="http://place.map.kakao.com/100",
        lat=37.5560,
        lng=126.9250,
    )
    # 도로명 주소가 없으면 지번 주소로
    assert places[1].address == "서울 마포구 합정동 2"


@respx.mock
def test_cafe_uses_ce7_code(seeded):
    route = respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json=_load("kakao_category_food.json")))
    get_places(seeded.get(Hub, 1), "cafe", KakaoLocalClient("k"), ContentCacheRepo(seeded))
    assert route.calls.last.request.url.params["category_group_code"] == "CE7"


@respx.mock
def test_play_queries_every_keyword_and_dedupes(seeded):
    route = respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json=_load("kakao_keyword_play.json")))
    places = get_places(seeded.get(Hub, 1), "play", KakaoLocalClient("k"), ContentCacheRepo(seeded))
    assert route.call_count == len(PLAY_KEYWORDS)
    assert [p.id for p in places] == ["200"]


@respx.mock
def test_second_call_is_served_from_cache(seeded):
    route = respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json=_load("kakao_category_food.json")))
    hub = seeded.get(Hub, 1)
    cache = ContentCacheRepo(seeded)
    first = get_places(hub, "food", KakaoLocalClient("k"), cache)
    second = get_places(hub, "food", KakaoLocalClient("k"), cache)
    assert route.call_count == 1
    assert first == second


@respx.mock
def test_count_category_returns_meta_total():
    respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json={"meta": {"total_count": 42}, "documents": []}))
    assert KakaoLocalClient("k").count_category("FD6", 37.5, 127.0) == 42


@respx.mock
def test_count_keyword_returns_meta_total():
    respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json={"meta": {"total_count": 7}, "documents": []}))
    assert KakaoLocalClient("k").count_keyword("방탈출", 37.5, 127.0) == 7
