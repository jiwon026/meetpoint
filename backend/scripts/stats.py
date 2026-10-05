"""날짜별 규모 통계를 출력한다.

실행: python -m scripts.stats  (대상 DB는 .env 또는 환경 변수의 DATABASE_URL)
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import DailyStat


def summarize(session: Session) -> list[DailyStat]:
    return list(session.scalars(select(DailyStat).order_by(DailyStat.day)).all())


if __name__ == "__main__":
    with SessionLocal() as s:
        rows = summarize(s)
    print("day         rooms  people  with_result")
    for r in rows:
        print(f"{r.day}  {r.rooms_created:5d}  {r.participants_added:6d}  {r.rooms_with_result:11d}")
    rooms = sum(r.rooms_created for r in rows)
    people = sum(r.participants_added for r in rows)
    reached = sum(r.rooms_with_result for r in rows)
    print(f"total       {rooms:5d}  {people:6d}  {reached:11d}")
    if rooms:
        print(f"people per room: {people / rooms:.1f}, rooms that reached a result: {reached / rooms:.0%}")
