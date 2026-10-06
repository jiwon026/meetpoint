import json
from pathlib import Path

import httpx
import respx

from app.cache import ContentCacheRepo
from app.models import Hub
from app.places.kakao_local import KakaoLocalClient
from app.places.service import PLACE_LIMIT, PLAY_KEYWORDS, Place, get_places, place_cache_key

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


def _doc(i: int, category: str) -> dict:
    return {
        "id": str(i), "place_name": f"가게 {i}", "category_name": category, "road_address_name": "서울 어딘가",
        "distance": str(i * 10), "place_url": f"http://place.map.kakao.com/{i}", "x": "126.92", "y": "37.55",
    }


@respx.mock
def test_recommended_is_the_default_and_asks_kakao_for_accuracy_order(seeded):
    route = respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json=_load("kakao_category_food.json")))
    hub = seeded.get(Hub, 1)
    cache = ContentCacheRepo(seeded)
    get_places(hub, "food", KakaoLocalClient("k"), cache)
    assert route.calls.last.request.url.params["sort"] == "accuracy"
    get_places(hub, "food", KakaoLocalClient("k"), cache, sort="distance")
    assert route.calls.last.request.url.params["sort"] == "distance"
    # 정렬마다 따로 캐시한다. 같은 정렬의 두 번째 요청은 카카오를 부르지 않는다.
    get_places(hub, "food", KakaoLocalClient("k"), cache)
    get_places(hub, "food", KakaoLocalClient("k"), cache, sort="distance")
    assert route.call_count == 2
    assert place_cache_key(1, "food", "recommended") != place_cache_key(1, "food", "distance")


@respx.mock
def test_cafe_drops_comic_board_game_and_kids_cafes(seeded):
    docs = [
        _doc(1, "가정,생활 > 여가시설 > 만화방 > 만화카페 > 벌툰"),
        _doc(2, "음식점 > 카페 > 커피전문점 > 스타벅스"),
        _doc(3, "가정,생활 > 여가시설 > 보드카페 > 레드버튼"),
        _doc(4, "음식점 > 카페 > 테마카페 > 디저트카페"),
        _doc(5, "서비스,산업 > 전문대행 > 공간대여 > 모임공간"),
        _doc(6, "가정,생활 > 유아 > 놀이시설 > 키즈카페"),
        _doc(7, "음식점 > 카페"),
        # 세부 종류가 없는 테마카페는 방탈출, 공방, 힐링카페 같은 체험 공간이 대부분이다.
        _doc(8, "음식점 > 카페 > 테마카페"),
        _doc(9, "음식점 > 카페 > 테마카페 > 북카페"),
    ]
    respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json={"documents": docs}))
    places = get_places(seeded.get(Hub, 1), "cafe", KakaoLocalClient("k"), ContentCacheRepo(seeded))
    assert [p.id for p in places] == ["2", "4", "7", "9"]


@respx.mock
def test_cafe_reads_more_pages_until_the_list_is_full(seeded):
    def page(request):
        n = int(request.url.params["page"])
        # 쪽마다 15곳 중 5곳만 진짜 카페다.
        docs = [_doc(n * 100 + i, "음식점 > 카페" if i < 5 else "가정,생활 > 여가시설 > 보드카페") for i in range(15)]
        return httpx.Response(200, json={"documents": docs})

    route = respx.get(CATEGORY_URL).mock(side_effect=page)
    places = get_places(seeded.get(Hub, 1), "cafe", KakaoLocalClient("k"), ContentCacheRepo(seeded))
    assert route.call_count == 3
    assert [r.request.url.params["page"] for r in route.calls] == ["1", "2", "3"]
    assert len(places) == PLACE_LIMIT
    assert [p.id for p in places[:6]] == ["100", "101", "102", "103", "104", "200"]


@respx.mock
def test_food_reads_one_page(seeded):
    docs = [_doc(i, "음식점 > 한식") for i in range(15)]
    route = respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json={"documents": docs}))
    places = get_places(seeded.get(Hub, 1), "food", KakaoLocalClient("k"), ContentCacheRepo(seeded))
    assert route.call_count == 1
    assert len(places) == 15


@respx.mock
def test_play_ignores_sort_and_shares_one_cache_entry(seeded):
    route = respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json=_load("kakao_keyword_play.json")))
    hub = seeded.get(Hub, 1)
    cache = ContentCacheRepo(seeded)
    get_places(hub, "play", KakaoLocalClient("k"), cache, sort="recommended")
    get_places(hub, "play", KakaoLocalClient("k"), cache, sort="distance")
    assert route.call_count == len(PLAY_KEYWORDS)
    assert all(c.request.url.params["sort"] == "distance" for c in route.calls)


# 분류 이름은 2026-10-06에 강남, 홍대입구, 정발산, 부평, 수원에서 실제로 받은 응답에서 가져왔다.
@respx.mock
def test_drink_searches_the_bar_keyword_inside_restaurants(seeded):
    docs = [
        _doc(1, "음식점 > 술집 > 호프,요리주점"),
        _doc(2, "음식점 > 술집"),
        _doc(3, "음식점 > 양식"),
        _doc(4, "음식점 > 술집 > 일본식주점 > 생마차"),
        _doc(5, "음식점 > 술집 > 칵테일바"),
    ]
    route = respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json={"documents": docs}))
    places = get_places(seeded.get(Hub, 1), "drink", KakaoLocalClient("k"), ContentCacheRepo(seeded))
    params = route.calls.last.request.url.params
    assert params["query"] == "술집"
    assert params["category_group_code"] == "FD6"
    assert params["sort"] == "accuracy"
    # 검색어에 걸렸어도 술집으로 분류되지 않은 곳은 뺀다.
    assert [p.id for p in places] == ["1", "2", "4", "5"]
    assert route.call_count == 1


# 가게 이름과 분류는 2026-10-06에 강남, 홍대입구, 종각에서 실제로 받은 응답이다.
@respx.mock
def test_drink_drops_places_named_club(seeded):
    docs = [
        {**_doc(1, "음식점 > 술집 > 호프,요리주점"), "place_name": "클럽도파"},
        {**_doc(2, "음식점 > 술집 > 호프,요리주점"), "place_name": "왕스펍"},
        {**_doc(3, "음식점 > 술집 > 와인바"), "place_name": "블루아워 Jazz Club"},
        {**_doc(4, "음식점 > 술집 > 칵테일바"), "place_name": "서울소사이어티클럽"},
        {**_doc(5, "음식점 > 술집 > 일본식주점"), "place_name": "이자카야신조"},
    ]
    respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json={"documents": docs}))
    places = get_places(seeded.get(Hub, 1), "drink", KakaoLocalClient("k"), ContentCacheRepo(seeded))
    assert [p.name for p in places] == ["왕스펍", "이자카야신조"]


@respx.mock
def test_drink_can_be_sorted_and_caches_each_sort(seeded):
    docs = [_doc(i, "음식점 > 술집 > 호프,요리주점") for i in range(15)]
    route = respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json={"documents": docs}))
    hub = seeded.get(Hub, 1)
    cache = ContentCacheRepo(seeded)
    get_places(hub, "drink", KakaoLocalClient("k"), cache, sort="distance")
    assert route.calls.last.request.url.params["sort"] == "distance"
    get_places(hub, "drink", KakaoLocalClient("k"), cache)
    get_places(hub, "drink", KakaoLocalClient("k"), cache, sort="distance")
    assert route.call_count == 2
    assert place_cache_key(1, "drink", "recommended") != place_cache_key(1, "drink", "distance")


@respx.mock
def test_drink_reads_more_pages_until_the_list_is_full(seeded):
    def page(request):
        n = int(request.url.params["page"])
        docs = [_doc(n * 100 + i, "음식점 > 술집" if i < 10 else "음식점 > 한식") for i in range(15)]
        return httpx.Response(200, json={"documents": docs})

    route = respx.get(KEYWORD_URL).mock(side_effect=page)
    places = get_places(seeded.get(Hub, 1), "drink", KakaoLocalClient("k"), ContentCacheRepo(seeded))
    assert [r.request.url.params["page"] for r in route.calls] == ["1", "2"]
    assert len(places) == PLACE_LIMIT
