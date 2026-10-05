from datetime import date, datetime, timedelta

KST_OFFSET = timedelta(hours=9)


def kst_date(now_utc: datetime) -> date:
    """서버는 UTC로 돈다. 약속 날짜와 통계의 "오늘"은 한국 시간 기준이다."""
    return (now_utc + KST_OFFSET).date()
