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
    seeded.get(Hub, 1).themes = ["food", "cafe"]   # 홍대입구
    seeded.get(Hub, 2).themes = ["cafe"]           # 강남
    seeded.get(Hub, 4).themes = ["food"]           # 건대입구
    seeded.add(Station(id=7, name="강남", line="신분당선", lat=37.4979, lng=127.0276, group_id=2))
    seeded.commit()
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: NoGeocoder()
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    return TestClient(app)


def _room(client, **extra):
    response = client.post("/rooms", json={"title": "테마 모임", "meet_date": "2026-10-10", **extra})
    assert response.status_code == 201, response.text
    return response.json()


def _join_gangnam_and_kondae(client, slug):
    for nickname, station_id in (("강남사람", 2), ("건대사람", 4)):
        response = client.post(f"/rooms/{slug}/participants", json={"nickname": nickname, "station_id": station_id})
        assert response.status_code == 201, response.text


def _names(body):
    return [r["name"] for r in body["recommendations"]]


def test_room_stores_theme_and_defaults_to_none(client):
    assert _room(client)["theme"] is None
    assert _room(client, theme="cafe")["theme"] == "cafe"


def test_room_rejects_unknown_theme(client):
    response = client.post("/rooms", json={"title": "t", "meet_date": "2026-10-10", "theme": "study"})
    assert response.status_code == 422


def test_no_theme_keeps_fairness_order(client):
    slug = _room(client)["slug"]
    _join_gangnam_and_kondae(client, slug)
    body = client.get(f"/rooms/{slug}/result").json()
    # 최대 시간: 잠실 20, 강남 25, 건대입구 25, 홍대입구 40
    assert _names(body) == ["잠실", "강남", "건대입구", "홍대입구"]
    assert body["best_max_minutes"] == 20
    assert body["theme"] is None
    assert [r["theme_match"] for r in body["recommendations"]] == [False, False, False, False]


def test_theme_moves_matching_hub_within_five_minutes_first(client):
    slug = _room(client, theme="food")["slug"]
    _join_gangnam_and_kondae(client, slug)
    body = client.get(f"/rooms/{slug}/result").json()
    # 건대입구(25분)는 가장 빠른 잠실(20분)보다 5분 느려 앞으로 온다. 홍대입구(40분)는 맞는 테마여도 제자리.
    assert _names(body) == ["건대입구", "잠실", "강남", "홍대입구"]
    assert body["best_max_minutes"] == 20
    assert body["theme"] == "food"
    assert {r["name"]: r["theme_match"] for r in body["recommendations"]} == {
        "건대입구": True, "잠실": False, "강남": False, "홍대입구": True,
    }


def test_query_theme_overrides_room_theme_and_any_turns_it_off(client):
    slug = _room(client, theme="food")["slug"]
    _join_gangnam_and_kondae(client, slug)
    cafe = client.get(f"/rooms/{slug}/result", params={"theme": "cafe"}).json()
    assert _names(cafe) == ["강남", "잠실", "건대입구", "홍대입구"]
    assert cafe["theme"] == "cafe"
    off = client.get(f"/rooms/{slug}/result", params={"theme": "any"}).json()
    assert _names(off) == ["잠실", "강남", "건대입구", "홍대입구"]
    assert off["theme"] is None


def test_unknown_theme_query_is_422(client):
    slug = _room(client)["slug"]
    assert client.get(f"/rooms/{slug}/result", params={"theme": "study"}).status_code == 422


def test_recommendations_carry_hub_lines(client):
    slug = _room(client)["slug"]
    _join_gangnam_and_kondae(client, slug)
    body = client.get(f"/rooms/{slug}/result").json()
    lines = {r["name"]: r["lines"] for r in body["recommendations"]}
    assert lines["강남"] == ["2호선", "신분당선"]
    assert lines["잠실"] == ["2호선"]


def test_waiting_result_has_no_best(client):
    slug = _room(client, theme="play")["slug"]
    body = client.get(f"/rooms/{slug}/result").json()
    assert body["status"] == "waiting"
    assert body["best_max_minutes"] is None
    assert body["theme"] == "play"
