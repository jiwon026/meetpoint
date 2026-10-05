import logging
from datetime import datetime
from typing import Literal

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.clock import kst_date
from app.models import DailyStat

logger = logging.getLogger(__name__)

StatColumn = Literal["rooms_created", "participants_added", "rooms_with_result"]


def _increment(session: Session, day, column: StatColumn) -> int:
    counter = getattr(DailyStat, column)
    statement = (
        update(DailyStat)
        .where(DailyStat.day == day)
        .values({column: counter + 1})
        .execution_options(synchronize_session=False)
    )
    return session.execute(statement).rowcount


def bump(session: Session, column: StatColumn, now: datetime) -> None:
    """그날의 개수를 1 올린다. 본 작업이 커밋된 뒤에 부른다. 실패해도 요청을 깨지 않는다.

    호출한 쪽의 세션은 건드리지 않는다(커밋도 롤백도 하지 않는다). 같은 연결 대상에 짧은 세션을 따로 열어 쓴다.
    그래야 통계 쓰기가 실패해도 호출한 쪽의 객체가 만료되지 않아 응답이 추가 조회에 기대지 않는다.
    """
    day = kst_date(now)
    try:
        with Session(session.get_bind()) as own:
            try:
                if _increment(own, day, column) == 0:
                    own.add(DailyStat(day=day, **{column: 1}))
                own.commit()
            except IntegrityError:
                # 다른 요청이 같은 날의 행을 먼저 만들었다. 이제 행이 있으니 다시 올린다.
                own.rollback()
                _increment(own, day, column)
                own.commit()
    except SQLAlchemyError as exc:
        logger.warning("stat bump failed column=%s error=%s", column, type(exc).__name__)
