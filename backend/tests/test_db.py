import pytest

from app.db import make_engine, normalize_database_url


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ("postgresql://u:p@h:5432/db", "postgresql+psycopg://u:p@h:5432/db"),
        ("postgres://u:p@h:5432/db", "postgresql+psycopg://u:p@h:5432/db"),
        ("postgresql+psycopg://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
        ("sqlite:///./dev.db", "sqlite:///./dev.db"),
    ],
)
def test_normalize_database_url(given, expected):
    assert normalize_database_url(given) == expected


def test_postgres_engine_uses_a_small_pool():
    # 세션 모드 풀러의 연결 수에 여유를 둔다. 인스턴스는 하나다. (엔진을 만들기만 하고 접속하지 않는다.)
    engine = make_engine("postgresql://u:p@localhost:5432/db")
    assert engine.pool.size() == 5
    assert engine.pool._max_overflow == 5


def test_sqlite_engine_is_unchanged():
    assert make_engine("sqlite://").dialect.name == "sqlite"
