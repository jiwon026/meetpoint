from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Station


def all_stations(session: Session) -> list[Station]:
    return list(session.scalars(select(Station).order_by(Station.id)).all())


def search_stations(session: Session, q: str, limit: int = 10) -> list[Station]:
    term = q.strip()
    if not term:
        return []
    stmt = (
        select(Station)
        .where(Station.name.like(f"%{term}%"))
        .order_by(Station.name, Station.id)
        .limit(limit)
    )
    return list(session.scalars(stmt).all())
