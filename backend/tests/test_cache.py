from datetime import datetime, timedelta

from app.cache import CONTENT_TTL, ContentCacheRepo


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
