import pytest
from fastapi.testclient import TestClient

from app.db import get_db
from app.deps import get_geocoder, get_matrix
from app.main import create_app
from app.models import Hub, Station
from app.transit.matrix import StationTimeMatrix


class NoGeocoder:
    def geocode(self, query: str):
        return None


@pytest.fixture
def client(seeded):
    sinchon = seeded.get(Station, 5)
    suwon = seeded.get(Station, 6)
    seeded.add_all([
        Hub(id=5, station_id=5, group_id=5, name="신촌", lat=sinchon.lat, lng=sinchon.lng,
            region="서울", tags=["대학가"], vibe_summary="대학가 골목이 이어지는 동네"),
        Hub(id=6, station_id=6, group_id=6, name="수원", lat=suwon.lat, lng=suwon.lng,
            region="경기", tags=["교통요지"], vibe_summary="경기 남부에서 모이기 쉬운 곳"),
    ])
    seeded.commit()
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: NoGeocoder()
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4, 5, 6})
    return TestClient(app)


def _room(client, **extra):
    response = client.post("/rooms", json={"title": "주말 모임", "meet_date": "2026-10-10", **extra})
    assert response.status_code == 201, response.text
    return response.json()


def _join_two_from_hongdae(client, slug):
    for nickname in ("가", "나"):
        response = client.post(f"/rooms/{slug}/participants", json={"nickname": nickname, "station_id": 1})
        assert response.status_code == 201, response.text


def _names(body):
    return [r["name"] for r in body["recommendations"]]


def test_room_defaults_to_all_regions(client):
    assert _room(client)["regions"] == ["서울", "경기", "인천"]


def test_room_stores_chosen_regions_in_canonical_order(client):
    assert _room(client, regions=["경기", "서울", "경기"])["regions"] == ["서울", "경기"]


def test_room_rejects_empty_or_unknown_regions(client):
    for bad in ([], ["부산"]):
        response = client.post("/rooms", json={"title": "t", "meet_date": "2026-10-10", "regions": bad})
        assert response.status_code == 422, bad


def test_result_without_filter_uses_all_regions_and_cuts_to_five(client):
    slug = _room(client)["slug"]
    _join_two_from_hongdae(client, slug)
    body = client.get(f"/rooms/{slug}/result").json()
    assert _names(body) == ["홍대입구", "신촌", "건대입구", "강남", "잠실"]
    assert body["regions"] == ["서울", "경기", "인천"]


def test_region_filter_applies_before_top_five_cut(client):
    """수원은 전체 6위라 상위 5곳에서 잘린다. 경기만 고르면 자르기 전에 걸러져서 수원이 나와야 한다."""
    slug = _room(client)["slug"]
    _join_two_from_hongdae(client, slug)
    body = client.get(f"/rooms/{slug}/result", params={"region": "경기"}).json()
    assert body["status"] == "ready"
    assert _names(body) == ["수원"]
    assert body["regions"] == ["경기"]


def test_room_regions_are_the_default_filter_and_query_overrides(client):
    slug = _room(client, regions=["경기"])["slug"]
    _join_two_from_hongdae(client, slug)
    assert _names(client.get(f"/rooms/{slug}/result").json()) == ["수원"]
    widened = client.get(f"/rooms/{slug}/result", params={"region": ["서울", "경기"]}).json()
    assert len(widened["recommendations"]) == 5
    assert widened["regions"] == ["서울", "경기"]


def test_region_with_no_hubs_is_ready_but_empty(client):
    slug = _room(client)["slug"]
    _join_two_from_hongdae(client, slug)
    body = client.get(f"/rooms/{slug}/result", params={"region": "인천"}).json()
    assert body["status"] == "ready"
    assert body["recommendations"] == []


def test_waiting_result_still_reports_regions(client):
    slug = _room(client, regions=["서울"])["slug"]
    body = client.get(f"/rooms/{slug}/result").json()
    assert body["status"] == "waiting"
    assert body["regions"] == ["서울"]


def test_unknown_region_query_is_422(client):
    slug = _room(client)["slug"]
    assert client.get(f"/rooms/{slug}/result", params={"region": "부산"}).status_code == 422
