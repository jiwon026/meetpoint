import pytest
from sqlalchemy import select

from app.geocoding.nearest import StationWalk, nearest_stations
from app.models import Station


def _stations(seeded):
    return seeded.scalars(select(Station)).all()


def test_returns_up_to_three_nearest_sorted_by_distance(seeded):
    # 홍대입구와 신촌 사이 지점
    result = nearest_stations(37.5560, 126.9300, _stations(seeded))
    names = {r.station_name for r in result[:2]}
    assert names == {"홍대입구", "신촌"}
    assert len(result) <= 3
    assert all(r.via == "walk" for r in result)


def test_walk_minutes_are_positive_and_increasing(seeded):
    result = nearest_stations(37.5560, 126.9300, _stations(seeded))
    minutes = [r.walk_minutes for r in result]
    assert minutes == sorted(minutes)
    assert minutes[0] > 0


def test_far_from_any_station_falls_back_to_bus(seeded):
    # 과천 근처, 시드 역들에서 2km 넘게 떨어진 지점
    result = nearest_stations(37.4300, 126.9900, _stations(seeded))
    assert len(result) == 1
    assert result[0].via == "bus"
    assert result[0].walk_minutes == 15
    assert result[0].station_name == "강남"


def test_station_walk_is_immutable():
    sw = StationWalk(station_id=1, station_name="홍대입구", walk_minutes=5, via="walk")
    with pytest.raises(AttributeError):
        sw.walk_minutes = 10  # type: ignore[misc]
