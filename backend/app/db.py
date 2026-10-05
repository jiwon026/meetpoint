from collections.abc import Iterator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


POSTGRES_PREFIXES = ("postgres://", "postgresql://")


def normalize_database_url(url: str) -> str:
    """Supabase가 주는 postgres:// 또는 postgresql:// 를 psycopg3 드라이버 URL로 바꾼다."""
    for prefix in POSTGRES_PREFIXES:
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


POOL_SIZE = 5
POOL_MAX_OVERFLOW = 5


def make_engine(url: str) -> Engine:
    url = normalize_database_url(url)
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False}, pool_pre_ping=True)
    # Supabase 세션 모드 풀러에 붙는다. 서버 인스턴스가 하나라는 전제의 크기다.
    return create_engine(url, pool_pre_ping=True, pool_size=POOL_SIZE, max_overflow=POOL_MAX_OVERFLOW)


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
