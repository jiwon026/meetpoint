import pytest

from pipeline.estimate import calibrate_speed, estimate_minutes, parse_mmss


def test_urban_two_km_is_about_four_minutes():
    # 2 / 32 * 60 + 0.5 = 4.25 -> 4.2 (소수 1자리 반올림)
    assert estimate_minutes(2.0, "urban") == pytest.approx(4.2, abs=0.05)


def test_regional_is_faster_per_km():
    assert estimate_minutes(10.0, "regional") < estimate_minutes(10.0, "urban")


def test_gtx_is_fastest():
    assert estimate_minutes(20.0, "gtx") < estimate_minutes(20.0, "regional")


def test_minimum_is_one_minute():
    assert estimate_minutes(0.1, "urban") == 1.0


def test_unknown_class_raises():
    with pytest.raises(KeyError):
        estimate_minutes(1.0, "tram")


def test_calibrate_recovers_speed():
    speed = 30.0
    pairs = [(km, km / speed * 60 + 0.5) for km in (0.8, 1.2, 1.5, 2.0, 3.1)]
    assert calibrate_speed(pairs) == pytest.approx(30.0, rel=1e-6)


def test_calibrate_ignores_zero_km():
    assert calibrate_speed([(0.0, 0.0), (2.0, 4.5)]) == pytest.approx(30.0, rel=1e-6)


@pytest.mark.parametrize(
    ("value", "expected"),
    [("02:00", 2.0), ("02:30", 2.5), ("00:30", 0.5), ("01:45", 1.75), ("invalid", None), ("", None), (None, None)],
)
def test_parse_mmss(value, expected):
    assert parse_mmss(value) == expected
