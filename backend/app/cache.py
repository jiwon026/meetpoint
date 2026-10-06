from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import ContentCache

CONTENT_TTL = timedelta(hours=24)
VENUE_TTL = timedelta(days=30)


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class ContentCacheRepo:
    def __init__(self, session: Session, now: Callable[[], datetime] = utcnow) -> None:
        self._session = session
        self._now = now

    def _row(self, key: str) -> ContentCache | None:
        return self._session.scalar(select(ContentCache).where(ContentCache.cache_key == key))

    def get(self, key: str, ttl: timedelta) -> object | None:
        row = self._row(key)
        if row is None or row.fetched_at + ttl < self._now():
            return None
        return row.payload

    def get_stale(self, key: str) -> object | None:
        row = self._row(key)
        return None if row is None else row.payload

    def set(self, key: str, payload: object, kind: str, hub_id: int | None = None) -> None:
        try:
            self._write(key, payload, kind, hub_id)
        except IntegrityError:
            # 다른 요청이 같은 키를 먼저 넣었다. 이제 행이 있으니 그 행을 고친다.
            self._session.rollback()
            self._write(key, payload, kind, hub_id)

    def _write(self, key: str, payload: object, kind: str, hub_id: int | None) -> None:
        row = self._row(key)
        if row is None:
            row = ContentCache(cache_key=key, kind=kind, hub_id=hub_id)
            self._session.add(row)
        row.payload = payload
        row.kind = kind
        row.hub_id = hub_id
        row.fetched_at = self._now()
        self._session.commit()

    def release(self) -> None:
        """읽기만 한 트랜잭션을 끝내 연결을 풀에 돌려준다. 오래 걸리는 외부 호출 전에 부른다."""
        self._session.commit()
