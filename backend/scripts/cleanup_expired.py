"""만료된 방과 오래된 콘텐츠 캐시를 지운다. Railway cron에서 하루 한 번 실행한다.

실행: python -m scripts.cleanup_expired
"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cache import utcnow
from app.db import SessionLocal
from app.models import ContentCache, Room

CACHE_MAX_AGE = timedelta(days=30)


def delete_expired_rooms(session: Session, now: datetime) -> int:
    expired = session.scalars(select(Room).where(Room.expires_at < now)).all()
    for room in expired:
        session.delete(room)  # participants는 cascade로 함께 삭제
    session.commit()
    return len(expired)


def delete_stale_cache(session: Session, now: datetime, max_age: timedelta = CACHE_MAX_AGE) -> int:
    """오래 쓰이지 않은 캐시 행을 지운다. 방과 달리 캐시는 스스로 만료되지 않고 쌓이기만 한다."""
    cutoff = now - max_age
    stale = session.scalars(select(ContentCache).where(ContentCache.fetched_at < cutoff)).all()
    for row in stale:
        session.delete(row)
    session.commit()
    return len(stale)


if __name__ == "__main__":
    with SessionLocal() as s:
        now = utcnow()
        rooms = delete_expired_rooms(s, now)
        cache_rows = delete_stale_cache(s, now)
    print(f"deleted {rooms} expired rooms")
    print(f"deleted {cache_rows} stale cache rows")
