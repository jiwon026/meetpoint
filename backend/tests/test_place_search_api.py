import logging

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.db import get_db
from app.deps import get_local_client
from app.main import create_app
from app.places.kakao_local import KakaoLocalClient

KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
DOCS = {
    "documents": [
        {"place_name": "스타벅스 강남역점", "road_address_name": "서울 강남구 강남대로 390", "address_name": "서울 강남구 역삼동 825"},
        {"place_name": "강남구청", "road_address_name": "", "address_name": "서울 강남구 삼성동 16-1"},
        {"place_name": "주소없는곳", "road_address_name": "", "address_name": ""},
    ]
}


@pytest.fixture
def client(seeded):
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_local_client] = lambda: KakaoLocalClient("k")
    return TestClient(app)


@respx.mock
def test_search_returns_name_and_address_inside_metro(client):
    route = respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json=DOCS))
    response = client.post("/places/search", json={"q": "  강남역 스타벅스 "})
    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {"name": "스타벅스 강남역점", "address": "서울 강남구 강남대로 390"},   # 도로명 주소 우선
            {"name": "강남구청", "address": "서울 강남구 삼성동 16-1"},             # 없으면 지번
        ],
        "error": None,
    }
    params = route.calls.last.request.url.params
    assert params["query"] == "강남역 스타벅스"
    assert params["rect"] == "126.3,36.9,127.9,38.3"
    assert params["size"] == "5"
    assert "x" not in params and "radius" not in params


@respx.mock
def test_upstream_failure_returns_empty_items_with_message_and_does_not_log_query(client, caplog):
    respx.get(KEYWORD_URL).mock(return_value=httpx.Response(500))
    with caplog.at_level(logging.WARNING):
        response = client.post("/places/search", json={"q": "우리집 주소"})
    assert response.status_code == 200
    assert response.json() == {"items": [], "error": "지금 불러올 수 없어요"}
    assert "우리집" not in caplog.text


def test_query_must_have_two_to_thirty_characters(client):
    for bad in ("a", "   ", "가" * 31):
        assert client.post("/places/search", json={"q": bad}).status_code == 422, bad


@respx.mock
def test_search_non_json_body_returns_friendly_error(client):
    respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, text="<html>blocked</html>"))
    response = client.post("/places/search", json={"q": "강남역"})
    assert response.status_code == 200
    assert response.json() == {"items": [], "error": "지금 불러올 수 없어요"}
