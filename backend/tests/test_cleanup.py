from datetime import date, datetime

from sqlalchemy import select

from app.models import Participant, Room
from scripts.cleanup_expired import delete_expired_rooms


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
