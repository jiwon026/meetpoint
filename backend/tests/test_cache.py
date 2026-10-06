from datetime import datetime, timedelta

from sqlalchemy import func, select

from app.cache import CONTENT_TTL, ContentCacheRepo
from app.models import ContentCache


class Clock:
    def __init__(self, start: datetime) -> None:
        self.now = start

    def __call__(self) -> datetime:
        return self.now


def test_miss_returns_none(session):
    repo = ContentCacheRepo(session)
    assert repo.get("nope", CONTENT_TTL) is None


def test_set_then_get_hits(session):
    repo = ContentCacheRepo(session)
    repo.set("places:1:food", [{"name": "국밥집"}], kind="food", hub_id=None)
    assert repo.get("places:1:food", CONTENT_TTL) == [{"name": "국밥집"}]


def test_expired_entry_is_a_miss_but_still_stale_readable(session):
    clock = Clock(datetime(2026, 9, 23, 12, 0))
    repo = ContentCacheRepo(session, now=clock)
    repo.set("k", {"v": 1}, kind="food")
    clock.now += timedelta(hours=25)
    assert repo.get("k", CONTENT_TTL) is None
    assert repo.get_stale("k") == {"v": 1}


def test_set_overwrites_existing_key(session):
    repo = ContentCacheRepo(session)
    repo.set("k", 1, kind="food")
    repo.set("k", 2, kind="food")
    assert repo.get("k", CONTENT_TTL) == 2


def test_set_survives_another_request_inserting_the_same_key_first(session, monkeypatch):
    """두 요청이 같은 키를 처음 저장하면 뒤쪽의 INSERT가 유일 키에 걸린다. 그때는 있는 행을 고친다."""
    repo = ContentCacheRepo(session)
    real_row = repo._row
    calls = {"n": 0}

    def row_missing_once(key):
        calls["n"] += 1
        if calls["n"] == 1:
            # 다른 요청이 방금 같은 키를 넣었는데 이 요청은 아직 못 본 상황을 만든다.
            session.add(ContentCache(cache_key=key, kind="venue", payload={"la": "1", "lo": "1"}, fetched_at=datetime(2026, 1, 1)))
            session.commit()
            return None
        return real_row(key)

    monkeypatch.setattr(repo, "_row", row_missing_once)
    repo.set("venue:kopis:41:abc", {"la": "2", "lo": "2"}, kind="venue")
    assert repo.get_stale("venue:kopis:41:abc") == {"la": "2", "lo": "2"}
    assert session.scalar(select(func.count()).select_from(ContentCache)) == 1
