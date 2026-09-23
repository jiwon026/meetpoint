from datetime import datetime

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import get_db
from app.deps import get_geocoder, get_matrix
from app.geocoding.kakao import GeoPoint
from app.main import create_app
from app.models import Room
from app.transit.matrix import StationTimeMatrix


class FakeGeocoder:
    POINTS = {
        "홍대 근처": GeoPoint(37.5576, 126.9250),
        "수원역 근처": GeoPoint(37.2665, 127.0005),
        "잠실 근처": GeoPoint(37.5130, 127.1005),
        "부산 서면": GeoPoint(35.1579, 129.0594),
    }

    def geocode(self, query: str) -> GeoPoint | None:
        return self.POINTS.get(query)


@pytest.fixture
def client(seeded):
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: FakeGeocoder()
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    return TestClient(app)


def _create_room(client, title="금요일 저녁", meet_date="2026-09-26"):
    response = client.post("/rooms", json={"title": title, "meet_date": meet_date})
    assert response.status_code == 201, response.text
    return response.json()


def _room_row(session, slug: str) -> Room:
    return session.scalar(select(Room).where(Room.slug == slug))


def test_create_room_returns_slug_and_expiry(client):
    room = _create_room(client)
    assert len(room["slug"]) == 6
    assert room["title"] == "금요일 저녁"
    assert room["meet_date"] == "2026-09-26"
    assert room["expires_at"].startswith("2026-10-03")
    assert room["participants"] == []


def test_create_room_rejects_empty_title(client):
    response = client.post("/rooms", json={"title": "", "meet_date": "2026-09-26"})
    assert response.status_code == 422


def test_create_room_rejects_whitespace_only_title(client):
    response = client.post("/rooms", json={"title": "   ", "meet_date": "2026-09-26"})
    assert response.status_code == 422


def test_unknown_room_is_404(client):
    assert client.get("/rooms/zzzzzz").status_code == 404


def test_join_by_address_stores_rounded_coords_and_nearest_station(client, seeded):
    slug = _create_room(client)["slug"]
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "지수", "address": "홍대 근처"})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["nickname"] == "지수"
    assert body["nearest_station_name"] == "홍대입구"
    assert body["via"] == "walk"
    stored = _room_row(seeded, slug).participants[0]
    assert stored.lat == 37.558 and stored.lng == 126.925
    assert not hasattr(stored, "address")


def test_join_by_station_id(client):
    slug = _create_room(client)["slug"]
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "민준", "station_id": 3})
    assert response.status_code == 201
    assert response.json()["nearest_station_name"] == "잠실"


def test_join_requires_address_or_station(client):
    slug = _create_room(client)["slug"]
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "민준"})
    assert response.status_code == 422


def test_join_with_unknown_address_returns_friendly_error(client):
    slug = _create_room(client)["slug"]
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "a", "address": "없는곳"})
    assert response.status_code == 422
    assert response.json()["detail"] == "주소를 찾지 못했어요. 역을 직접 골라주세요."


def test_join_outside_metro_is_rejected(client):
    slug = _create_room(client)["slug"]
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "a", "address": "부산 서면"})
    assert response.status_code == 422
    assert response.json()["detail"] == "아직 수도권만 지원해요"


def test_result_is_waiting_with_one_participant(client):
    slug = _create_room(client)["slug"]
    client.post(f"/rooms/{slug}/participants", json={"nickname": "a", "address": "홍대 근처"})
    body = client.get(f"/rooms/{slug}/result").json()
    assert body["status"] == "waiting"
    assert body["recommendations"] == []


def test_result_ranks_hubs_fairly(client):
    slug = _create_room(client)["slug"]
    client.post(f"/rooms/{slug}/participants", json={"nickname": "홍대", "address": "홍대 근처"})
    client.post(f"/rooms/{slug}/participants", json={"nickname": "수원", "address": "수원역 근처"})
    client.post(f"/rooms/{slug}/participants", json={"nickname": "잠실", "address": "잠실 근처"})
    body = client.get(f"/rooms/{slug}/result").json()
    assert body["status"] == "ready"
    names = [r["name"] for r in body["recommendations"]]
    assert names[0] == "강남"
    top = body["recommendations"][0]
    assert top["vibe_summary"] == "어디서든 오기 쉬운 교통 중심"
    assert top["tags"] == ["교통요지", "회식"]
    assert {l["nickname"]: l["origin_station_name"] for l in top["legs"]} == {
        "홍대": "홍대입구", "수원": "수원", "잠실": "잠실"
    }
    assert top["max_minutes"] >= top["spread_minutes"]


def test_expired_room_is_410(client, seeded):
    slug = _create_room(client)["slug"]
    room = _room_row(seeded, slug)
    room.expires_at = datetime(2020, 1, 1)
    seeded.commit()
    response = client.get(f"/rooms/{slug}")
    assert response.status_code == 410
    assert response.json()["detail"] == "약속이 지난 방이에요"


def test_room_rejects_21st_participant(client):
    slug = _create_room(client)["slug"]
    for i in range(20):
        response = client.post(
            f"/rooms/{slug}/participants", json={"nickname": f"참여자{i}", "station_id": 1}
        )
        assert response.status_code == 201, response.text
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "늦둥이", "station_id": 1})
    assert response.status_code == 422
    assert response.json()["detail"] == "참여 인원이 가득 찼어요 (최대 20명)"


class BrokenGeocoder:
    def geocode(self, query: str):
        raise httpx.ConnectError("boom")


def test_geocoder_outage_returns_503_with_guidance(seeded):
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: BrokenGeocoder()
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    client = TestClient(app)
    slug = _create_room(client)["slug"]
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "a", "address": "홍대 근처"})
    assert response.status_code == 503
    assert response.json()["detail"] == "주소를 찾지 못했어요. 역을 직접 골라주세요."


def test_station_search_endpoint(client):
    body = client.get("/stations", params={"q": "입구"}).json()
    assert [s["name"] for s in body] == ["건대입구", "홍대입구"]
    assert set(body[0]) == {"id", "name", "line"}
