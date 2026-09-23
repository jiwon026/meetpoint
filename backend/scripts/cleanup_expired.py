"""만료된 방을 지운다. Railway cron에서 하루 한 번 실행한다.

실행: python -m scripts.cleanup_expired
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cache import utcnow
from app.db import SessionLocal
from app.models import Room


def delete_expired_rooms(session: Session, now: datetime) -> int:
    expired = session.scalars(select(Room).where(Room.expires_at < now)).all()
    for room in expired:
        session.delete(room)  # participants는 cascade로 함께 삭제
    session.commit()
    return len(expired)


if __name__ == "__main__":
    with SessionLocal() as s:
        count = delete_expired_rooms(s, utcnow())
    print(f"deleted {count} expired rooms")
