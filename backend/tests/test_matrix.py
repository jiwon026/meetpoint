from app.transit.matrix import StationTimeMatrix


def test_minutes_returns_seeded_value(seeded):
    matrix = StationTimeMatrix.load(seeded, to_station_ids={2})
    assert matrix.minutes(1, 2) == 35
    assert matrix.minutes(6, 2) == 60


def test_same_station_is_zero_even_if_not_loaded():
    matrix = StationTimeMatrix({})
    assert matrix.minutes(7, 7) == 0


def test_unknown_pair_returns_none(seeded):
    matrix = StationTimeMatrix.load(seeded, to_station_ids={2})
    assert matrix.minutes(1, 3) is None


def test_load_only_keeps_requested_destinations(seeded):
    matrix = StationTimeMatrix.load(seeded, to_station_ids={2, 3})
    assert matrix.minutes(1, 3) == 45
    assert matrix.minutes(1, 4) is None
