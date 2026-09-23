import pytest

from app.deps import get_matrix, reset_matrix_cache


@pytest.fixture(autouse=True)
def _clear_matrix_cache():
    reset_matrix_cache()
    yield
    reset_matrix_cache()


def test_get_matrix_is_cached_per_process(seeded):
    first = get_matrix(seeded)
    second = get_matrix(seeded)
    assert first is second
    assert first.minutes(1, 2) == 35


def test_empty_station_times_is_not_cached(session):
    first = get_matrix(session)
    second = get_matrix(session)
    assert len(first) == 0
    assert first is not second
