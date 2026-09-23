from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import StationTime


class StationTimeMatrix:
    """역간 최단 소요시간(분)을 메모리에 들고 조회만 한다. 만든 뒤에는 바꾸지 않는다."""

    def __init__(self, times: dict[tuple[int, int], int]) -> None:
        self._times = dict(times)

    @classmethod
    def load(cls, session: Session, to_station_ids: Iterable[int]) -> "StationTimeMatrix":
        ids = list(set(to_station_ids))
        # ORM 객체 대신 컬럼만 읽는다. 수만 행을 올릴 때 메모리와 시간 차이가 크다.
        stmt = select(StationTime.from_station_id, StationTime.to_station_id, StationTime.minutes).where(
            StationTime.to_station_id.in_(ids)
        )
        rows = session.execute(stmt).all()
        return cls({(f, t): m for f, t, m in rows})

    def minutes(self, from_id: int, to_id: int) -> int | None:
        if from_id == to_id:
            return 0
        return self._times.get((from_id, to_id))

    def __len__(self) -> int:
        return len(self._times)
