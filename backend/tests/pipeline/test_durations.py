import pytest

from pipeline.durations import parse_duration


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("02:00", 2.0),
        ("02:30", 2.5),
        ("00:30", 0.5),
        ("01:45", 1.75),
        ("1.5", 1.5),
        ("invalid", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_duration(value, expected):
    assert parse_duration(value) == expected
