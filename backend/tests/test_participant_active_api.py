import pytest
from fastapi.testclient import TestClient

from app.db import get_db
from app.deps import get_geocoder, get_matrix
from app.main import create_app
from app.transit.matrix import StationTimeMatrix


class NoGeocoder:
    def geocode(self, query: str):
        return None


@pytest.fixture
def client(seeded):
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: NoGeocoder()
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    return TestClient(app)


def _slug(client) -> str:
    return client.post("/rooms", json={"title": "모임", "meet_date": "2026-10-10"}).json()["slug"]


def _join(client, slug, nickname, station_id) -> dict:
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": nickname, "station_id": station_id})
    assert response.status_code == 201, response.text
    return response.json()


def _set_active(client, slug, participant_id, active):
    return client.patch(f"/rooms/{slug}/participants/{participant_id}", json={"active": active})


def test_new_participant_is_active(client):
    slug = _slug(client)
    assert _join(client, slug, "홍대", 1)["active"] is True
    assert client.get(f"/rooms/{slug}").json()["participants"][0]["active"] is True


def test_removed_participant_stays_listed_as_inactive(client):
    slug = _slug(client)
    p = _join(client, slug, "홍대", 1)
    response = _set_active(client, slug, p["id"], False)
    assert response.status_code == 200
    assert response.json()["active"] is False
    listed = client.get(f"/rooms/{slug}").json()["participants"]
    assert [(x["nickname"], x["active"]) for x in listed] == [("홍대", False)]


def test_result_ignores_inactive_and_waits_below_two(client):
    slug = _slug(client)
    a = _join(client, slug, "홍대", 1)
    b = _join(client, slug, "수원", 6)
    _join(client, slug, "잠실", 3)
    full = client.get(f"/rooms/{slug}/result").json()
    assert len(full["recommendations"][0]["legs"]) == 3

    _set_active(client, slug, b["id"], False)
    two = client.get(f"/rooms/{slug}/result").json()
    assert two["status"] == "ready"
    assert {l["nickname"] for l in two["recommendations"][0]["legs"]} == {"홍대", "잠실"}

    _set_active(client, slug, a["id"], False)
    one = client.get(f"/rooms/{slug}/result").json()
    assert one["status"] == "waiting"
    assert one["recommendations"] == []


def test_readding_restores_participant_in_result(client):
    slug = _slug(client)
    a = _join(client, slug, "홍대", 1)
    _join(client, slug, "잠실", 3)
    _set_active(client, slug, a["id"], False)
    assert client.get(f"/rooms/{slug}/result").json()["status"] == "waiting"
    assert _set_active(client, slug, a["id"], True).json()["active"] is True
    assert client.get(f"/rooms/{slug}/result").json()["status"] == "ready"


def test_participant_of_another_room_is_404(client):
    mine, other = _slug(client), _slug(client)
    stranger = _join(client, other, "남의방", 1)
    response = _set_active(client, mine, stranger["id"], False)
    assert response.status_code == 404
    assert response.json()["detail"] == "참여자를 찾을 수 없어요"
    assert client.get(f"/rooms/{other}").json()["participants"][0]["active"] is True


def test_unknown_participant_is_404(client):
    slug = _slug(client)
    assert _set_active(client, slug, 99999, False).status_code == 404


def test_inactive_participants_still_count_toward_capacity(client):
    slug = _slug(client)
    first = _join(client, slug, "참여자0", 1)
    for i in range(1, 20):
        _join(client, slug, f"참여자{i}", 1)
    _set_active(client, slug, first["id"], False)
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "늦둥이", "station_id": 1})
    assert response.status_code == 422
    assert response.json()["detail"] == "참여 인원이 가득 찼어요 (최대 20명)"
