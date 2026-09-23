from datetime import date, datetime, timedelta

from sqlalchemy import select

from app.models import ContentCache, Participant, Room
from scripts.cleanup_expired import delete_expired_rooms, delete_stale_cache


def _room(slug: str, expires: datetime) -> Room:
    return Room(slug=slug, title="t", meet_date=date(2026, 9, 1), created_at=expires, expires_at=expires)


def test_deletes_only_expired_rooms_and_their_participants(session):
    old = _room("old001", datetime(2026, 9, 1))
    new = _room("new001", datetime(2027, 1, 1))
    session.add_all([old, new])
    session.flush()
    session.add(
        Participant(
            room_id=old.id, nickname="a", lat=0, lng=0, nearest_stations=[], created_at=datetime(2026, 8, 1)
        )
    )
    session.commit()

    deleted = delete_expired_rooms(session, now=datetime(2026, 9, 23))

    assert deleted == 1
    assert [r.slug for r in session.scalars(select(Room)).all()] == ["new001"]
    assert session.scalars(select(Participant)).all() == []


def test_deletes_only_stale_content_cache_rows(session):
    now = datetime(2026, 9, 23)
    session.add_all(
        [
            ContentCache(
                kind="cafe", cache_key="places:1:cafe", payload=[], fetched_at=now - timedelta(days=40)
            ),
            ContentCache(
                kind="cafe", cache_key="places:2:cafe", payload=[], fetched_at=now - timedelta(days=1)
            ),
        ]
    )
    session.commit()

    deleted = delete_stale_cache(session, now)

    assert deleted == 1
    assert [r.cache_key for r in session.scalars(select(ContentCache)).all()] == ["places:2:cafe"]
