import json
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
def test_upstream_failure_returns_friendly_error_and_empty_items(client):
    respx.get(CATEGORY_URL).mock(return_value=httpx.Response(500))
    slug = _room_slug(client)
    response = client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "cafe"})
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["error"] == "지금 불러올 수 없어요"


@respx.mock
def test_upstream_failure_serves_stale_cache_when_present(client, seeded):
    respx.get(CATEGORY_URL).mock(return_value=httpx.Response(500))
    old_clock = lambda: datetime(2020, 1, 1)
    ContentCacheRepo(seeded, now=old_clock).set(
        "places:1:cafe",
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
