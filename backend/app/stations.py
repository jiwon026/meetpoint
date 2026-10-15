from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Station


@dataclass(frozen=True)
class StationHit:
    """검색 결과 한 줄. 환승역은 노선이 여럿이어도 한 줄이다."""

    id: int  # 묶인 노드 중 가장 작은 id. 고르면 같은 그룹의 모든 노선이 출발 후보가 된다.
    name: str
    lines: list[str]


def all_stations(session: Session) -> list[Station]:
    return list(session.scalars(select(Station).order_by(Station.id)).all())


def search_stations(session: Session, q: str, limit: int = 10) -> list[StationHit]:
    term = q.strip()
    if not term:
        return []
    stmt = select(Station).where(Station.name.like(f"%{term}%")).order_by(Station.name, Station.id)
    # 그룹과 이름이 모두 같은 노드만 한 줄로 묶는다. 이름만 보면 신촌(2호선)과 신촌(경의중앙선)이 합쳐지고,
    # 그룹만 보면 총신대입구와 이수가 합쳐진다. 묶은 뒤에 자르므로 limit은 노드가 아니라 역의 수다.
    nodes_by_key: dict[tuple[int, str], list[Station]] = {}
    for station in session.scalars(stmt):
        nodes_by_key.setdefault((station.group_id, station.name), []).append(station)
    return [
        StationHit(id=nodes[0].id, name=name, lines=sorted({s.line for s in nodes}))
        for (_, name), nodes in list(nodes_by_key.items())[:limit]
    ]
