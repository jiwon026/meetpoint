import pytest

from app.geo import haversine_km, is_in_metro, round_coord, walk_minutes


def test_haversine_seoul_city_hall_to_gangnam_is_about_8_7_km():
    km = haversine_km(37.5665, 126.9780, 37.4979, 127.0276)
    assert km == pytest.approx(8.7, abs=0.3)


def test_haversine_same_point_is_zero():
    assert haversine_km(37.5, 127.0, 37.5, 127.0) == 0


def test_walk_minutes_applies_detour_and_rounds_up():
    # 1km x 1.3 / 4km/h = 19.5분 -> 20분
    assert walk_minutes(1.0) == 20


def test_walk_minutes_zero_distance_is_zero():
    assert walk_minutes(0.0) == 0


def test_round_coord_keeps_three_decimals():
    assert round_coord(37.55712345) == 37.557
    assert round_coord(126.92449) == 126.924


def test_is_in_metro_true_for_seoul_and_suwon():
    assert is_in_metro(37.5665, 126.9780)
    assert is_in_metro(37.2660, 126.9999)


def test_is_in_metro_false_for_busan():
    assert not is_in_metro(35.1796, 129.0756)
