from sqlalchemy import select

from app.models import Hub, Station, StationTime


def test_seed_has_six_stations_and_four_hubs(seeded):
    assert len(seeded.scalars(select(Station)).all()) == 6
    assert len(seeded.scalars(select(Hub)).all()) == 4


def test_seed_station_times_are_symmetric(seeded):
    forward = seeded.get(StationTime, (1, 2))
    backward = seeded.get(StationTime, (2, 1))
    assert forward.minutes == backward.minutes == 35


def test_seed_self_time_is_zero(seeded):
    assert seeded.get(StationTime, (3, 3)).minutes == 0


def test_hub_tags_round_trip_as_list(seeded):
    hub = seeded.get(Hub, 1)
    assert hub.tags == ["밤늦게까지", "20대"]
