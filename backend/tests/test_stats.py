from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select

from app.db import get_db
from app.deps import get_geocoder, get_matrix
from app.main import create_app
from app.models import DailyStat, Room
import app.stats
from app.stats import bump
from app.transit.matrix import StationTimeMatrix
from scripts.stats import summarize

NOW = datetime(2026, 9, 20, 12, 0)   # conftest의 고정 시각과 같다. 한국 날짜로 2026-09-20.
DAY = date(2026, 9, 20)


def _row(session, day=DAY) -> DailyStat | None:
    session.expire_all()
    return session.get(DailyStat, day)


def test_bump_creates_the_day_row_then_increments(session):
    bump(session, "rooms_created", NOW)
    bump(session, "rooms_created", NOW)
    bump(session, "participants_added", NOW)
    row = _row(session)
    assert (row.rooms_created, row.participants_added, row.rooms_with_result) == (2, 1, 0)


def test_bump_uses_korean_date(session):
    bump(session, "rooms_created", datetime(2026, 9, 20, 15, 30))   # 한국은 21일 0시 30분
    assert _row(session) is None
    assert _row(session, date(2026, 9, 21)).rooms_created == 1


def test_bump_never_raises(session):
    DailyStat.__table__.drop(session.get_bind())
    bump(session, "rooms_created", NOW)   # 표가 없어도 조용히 넘어간다


@pytest.fixture
def client(seeded):
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: None
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    return TestClient(app)


def _room(client) -> str:
    return client.post("/rooms", json={"title": "t", "meet_date": "2026-09-26"}).json()["slug"]


def _join(client, slug: str, nickname: str, station_id: int) -> int:
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": nickname, "station_id": station_id})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_creating_rooms_and_joining_are_counted(client, seeded):
    slug = _room(client)
    _room(client)
    first = _join(client, slug, "a", 1)
    _join(client, slug, "b", 3)
    # 빼기와 다시 넣기는 새 사람이 아니다.
    client.patch(f"/rooms/{slug}/participants/{first}", json={"active": False})
    client.patch(f"/rooms/{slug}/participants/{first}", json={"active": True})
    row = _row(seeded)
    assert (row.rooms_created, row.participants_added) == (2, 2)


def test_rejected_requests_are_not_counted(client, seeded):
    client.post("/rooms", json={"title": "", "meet_date": "2026-09-26"})
    slug = _room(client)
    client.post(f"/rooms/{slug}/participants", json={"nickname": "a", "station_id": 999})
    row = _row(seeded)
    assert (row.rooms_created, row.participants_added) == (1, 0)


def test_first_ready_result_is_counted_once_per_room(client, seeded):
    slug = _room(client)
    _join(client, slug, "a", 1)
    assert client.get(f"/rooms/{slug}/result").json()["status"] == "waiting"
    assert _row(seeded).rooms_with_result == 0
    _join(client, slug, "b", 3)
    for _ in range(3):
        assert client.get(f"/rooms/{slug}/result").json()["status"] == "ready"
    assert _row(seeded).rooms_with_result == 1
    assert seeded.scalar(select(Room).where(Room.slug == slug)).first_result_at == NOW


def test_requests_succeed_when_the_stats_table_is_missing(client, seeded):
    DailyStat.__table__.drop(seeded.get_bind())
    slug = _room(client)
    _join(client, slug, "a", 1)
    _join(client, slug, "b", 3)
    body = client.get(f"/rooms/{slug}/result").json()
    assert body["status"] == "ready"
    assert len(body["recommendations"]) > 0


def test_summarize_orders_by_day(session):
    bump(session, "rooms_created", datetime(2026, 9, 21, 3, 0))
    bump(session, "rooms_created", NOW)
    assert [r.day for r in summarize(session)] == [DAY, date(2026, 9, 21)]


def test_bump_retries_once_when_another_request_created_the_row(session, monkeypatch):
    bump(session, "rooms_created", NOW)   # 그날의 행이 이미 있다
    real_increment = app.stats._increment
    calls = []

    def racing_increment(sess, day, column):
        calls.append(column)
        if len(calls) == 1:
            return 0   # 행이 없다고 본 요청이 INSERT를 시도하다 기본 키 충돌을 맞는다
        return real_increment(sess, day, column)

    monkeypatch.setattr("app.stats._increment", racing_increment)
    bump(session, "rooms_created", NOW)
    assert len(calls) == 2
    assert _row(session).rooms_created == 2


def test_failed_bump_leaves_the_callers_objects_loaded(session):
    room = Room(slug="abc", title="t", meet_date=DAY, created_at=NOW, expires_at=NOW)
    session.add(room)
    session.commit()
    DailyStat.__table__.drop(session.get_bind())
    bump(session, "rooms_created", NOW)
    assert inspect(room).expired_attributes == set()


def test_result_does_not_reload_the_room_after_marking(client, seeded, monkeypatch):
    slug = _room(client)
    _join(client, slug, "a", 1)
    _join(client, slug, "b", 3)

    def broken_refresh(*args, **kwargs):
        raise RuntimeError("reload must not be needed")

    monkeypatch.setattr(seeded, "refresh", broken_refresh)
    assert client.get(f"/rooms/{slug}/result").json()["status"] == "ready"
    assert _row(seeded).rooms_with_result == 1
