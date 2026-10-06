import json
import logging
from datetime import datetime
from pathlib import Path

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.cache import ContentCacheRepo
from app.db import get_db
from app.deps import get_cache, get_geocoder, get_local_client, get_matrix, get_seoul_client
from app.events.seoul import SeoulEventClient
from app.geocoding.kakao import GeoPoint
from app.main import create_app
from app.places.kakao_local import KakaoLocalClient
from app.places.service import place_cache_key
from app.transit.matrix import StationTimeMatrix

FIXTURES = Path(__file__).parent / "fixtures"
CATEGORY_URL = "https://dapi.kakao.com/v2/local/search/category.json"
SEOUL_PREFIX = "http://openapi.seoul.go.kr:8088/s-key/json/culturalEventInfo/"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class FakeGeocoder:
    def geocode(self, query: str) -> GeoPoint | None:
        return GeoPoint(37.5575, 126.9250)


@pytest.fixture
def client(seeded):
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: FakeGeocoder()
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    app.dependency_overrides[get_local_client] = lambda: KakaoLocalClient("k")
    app.dependency_overrides[get_seoul_client] = lambda: SeoulEventClient("s-key")
    app.dependency_overrides[get_cache] = lambda: ContentCacheRepo(seeded)
    return TestClient(app)


def _room_slug(client) -> str:
    return client.post("/rooms", json={"title": "t", "meet_date": "2026-09-26"}).json()["slug"]


@respx.mock
def test_food_content_returns_items(client):
    respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json=_load("kakao_category_food.json")))
    slug = _room_slug(client)
    body = client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "food"}).json()
    assert body["kind"] == "food"
    assert body["error"] is None
    assert body["items"][0]["name"] == "홍대 국밥집"


@respx.mock
def test_event_content_uses_room_meet_date(client):
    respx.get(url__startswith=SEOUL_PREFIX).mock(return_value=httpx.Response(200, json=_load("seoul_events.json")))
    slug = _room_slug(client)
    body = client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "event"}).json()
    titles = [i["title"] for i in body["items"]]
    assert "홍대 일러스트 페어" in titles


@respx.mock
def test_upstream_failure_returns_friendly_error_and_empty_items(client, caplog):
    respx.get(CATEGORY_URL).mock(return_value=httpx.Response(500))
    slug = _room_slug(client)
    with caplog.at_level(logging.WARNING):
        response = client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "cafe"})
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["error"] == "지금 불러올 수 없어요"
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert any("content fetch failed" in r.getMessage() and "kind=cafe" in r.getMessage() for r in warnings)
    assert all("dapi.kakao.com" not in r.getMessage() for r in caplog.records)


@respx.mock
def test_upstream_failure_serves_stale_cache_when_present(client, seeded):
    respx.get(CATEGORY_URL).mock(return_value=httpx.Response(500))
    old_clock = lambda: datetime(2020, 1, 1)
    ContentCacheRepo(seeded, now=old_clock).set(
        place_cache_key(1, "cafe"),
        [{"id": "1", "name": "옛날카페", "category": "카페", "address": "", "distance_m": 10, "url": "", "lat": 0.0, "lng": 0.0}],
        kind="cafe",
        hub_id=1,
    )
    slug = _room_slug(client)
    body = client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "cafe"}).json()
    assert body["items"][0]["name"] == "옛날카페"
    assert body["error"] == "지금 불러올 수 없어요"


@respx.mock
def test_event_upstream_error_returns_friendly_error_and_empty_items(client):
    respx.get(url__startswith=SEOUL_PREFIX).mock(
        return_value=httpx.Response(
            200,
            json={
                "culturalEventInfo": {
                    "RESULT": {"CODE": "ERROR-500", "MESSAGE": "서버 오류"},
                    "row": [],
                }
            },
        )
    )
    slug = _room_slug(client)
    response = client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "event"})
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["error"] == "지금 불러올 수 없어요"


def test_invalid_kind_is_422(client):
    slug = _room_slug(client)
    assert client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "bar"}).status_code == 422


def test_unknown_hub_is_404(client):
    slug = _room_slug(client)
    assert client.get(f"/rooms/{slug}/hubs/999/content", params={"kind": "food"}).status_code == 404


@respx.mock
def test_event_content_with_bad_seoul_key_returns_friendly_error(client):
    body = "<RESULT><CODE>INFO-100</CODE><MESSAGE>invalid key</MESSAGE></RESULT>"
    respx.get(url__startswith=SEOUL_PREFIX).mock(return_value=httpx.Response(200, text=body))
    slug = _room_slug(client)
    response = client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "event"})
    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["error"] is not None


@respx.mock
def test_place_content_sort_query(client):
    route = respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json=_load("kakao_category_food.json")))
    slug = _room_slug(client)
    client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "food"})
    assert route.calls.last.request.url.params["sort"] == "accuracy"
    client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "food", "sort": "distance"})
    assert route.calls.last.request.url.params["sort"] == "distance"
    assert client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "food", "sort": "rating"}).status_code == 422


@respx.mock
def test_stale_cache_is_served_for_the_requested_sort(client, seeded):
    respx.get(CATEGORY_URL).mock(return_value=httpx.Response(500))
    item = {"id": "1", "name": "가까운 옛날집", "category": "한식", "address": "", "distance_m": 10, "url": "", "lat": 0.0, "lng": 0.0}
    ContentCacheRepo(seeded, now=lambda: datetime(2020, 1, 1)).set(place_cache_key(1, "food", "distance"), [item], kind="food", hub_id=1)
    slug = _room_slug(client)
    assert client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "food", "sort": "distance"}).json()["items"][0]["name"] == "가까운 옛날집"
    assert client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "food"}).json()["items"] == []


@respx.mock
def test_drink_content_is_served(client):
    docs = [
        {
            "id": "7", "place_name": "홍대 포차", "category_name": "음식점 > 술집 > 실내포장마차",
            "road_address_name": "서울 마포구 어울마당로 1", "distance": "80",
            "place_url": "http://place.map.kakao.com/7", "x": "126.92", "y": "37.55",
        }
    ]
    respx.get("https://dapi.kakao.com/v2/local/search/keyword.json").mock(
        return_value=httpx.Response(200, json={"documents": docs})
    )
    slug = _room_slug(client)
    response = client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "drink", "sort": "distance"})
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "drink"
    assert body["items"][0]["name"] == "홍대 포차"
