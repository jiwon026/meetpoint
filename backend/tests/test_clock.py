from datetime import date, datetime

from app.clock import kst_date


def test_kst_date_is_nine_hours_ahead_of_utc():
    assert kst_date(datetime(2026, 9, 20, 14, 59)) == date(2026, 9, 20)
    assert kst_date(datetime(2026, 9, 20, 15, 0)) == date(2026, 9, 21)
