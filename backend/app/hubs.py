from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Hub, Station
from app.ranking.rank import HubCandidate
from app.stations import all_stations


def load_hub_candidates(
    session: Session, stations: Sequence[Station] | None = None
) -> tuple[list[Hub], list[HubCandidate]]:
    """거점과 같은 그룹(물리적으로 같은 역)에 속한 역 노드 id 묶음. stations를 주면 다시 읽지 않는다."""
    hubs = list(session.scalars(select(Hub).order_by(Hub.id)).all())
    nodes_by_group: dict[int, list[int]] = {}
    for s in stations if stations is not None else all_stations(session):
        nodes_by_group.setdefault(s.group_id, []).append(s.id)
    candidates = [
        HubCandidate(h.id, h.name, tuple(nodes_by_group.get(h.group_id, ()))) for h in hubs
    ]
    return hubs, candidates


def hub_lines(hubs: Sequence[Hub], stations: Sequence[Station]) -> dict[int, list[str]]:
    """거점 id별 노선 이름. 같은 그룹에 속한 역 노드의 노선을 중복 없이 정렬한다."""
    lines_by_group: dict[int, set[str]] = {}
    for s in stations:
        lines_by_group.setdefault(s.group_id, set()).add(s.line)
    return {h.id: sorted(lines_by_group.get(h.group_id, set())) for h in hubs}


def hub_node_ids(session: Session) -> set[int]:
    _, candidates = load_hub_candidates(session)
    return {node for c in candidates for node in c.node_ids}
