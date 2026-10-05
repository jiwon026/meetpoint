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
    """그날의 개수를 1 올린다. 본 작업이 커밋된 뒤에 부른다. 실패해도 요청을 깨지 않는다."""
    day = kst_date(now)
    try:
        if _increment(session, day, column) == 0:
            session.add(DailyStat(day=day, **{column: 1}))
        session.commit()
    except IntegrityError:
        # 다른 요청이 같은 날의 행을 먼저 만들었다. 이제 행이 있으니 다시 올린다.
        session.rollback()
        try:
            _increment(session, day, column)
            session.commit()
        except SQLAlchemyError as exc:
            session.rollback()
            logger.warning("stat bump failed column=%s error=%s", column, type(exc).__name__)
    except SQLAlchemyError as exc:
        session.rollback()
        logger.warning("stat bump failed column=%s error=%s", column, type(exc).__name__)
