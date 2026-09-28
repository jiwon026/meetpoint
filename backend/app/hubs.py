from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Hub
from app.ranking.rank import HubCandidate
from app.stations import all_stations


def load_hub_candidates(session: Session) -> tuple[list[Hub], list[HubCandidate]]:
    """거점과 같은 그룹(물리적으로 같은 역)에 속한 역 노드 id 묶음."""
    hubs = list(session.scalars(select(Hub).order_by(Hub.id)).all())
    nodes_by_group: dict[int, list[int]] = {}
    for s in all_stations(session):
        nodes_by_group.setdefault(s.group_id, []).append(s.id)
    candidates = [
        HubCandidate(h.id, h.name, tuple(nodes_by_group.get(h.group_id, ()))) for h in hubs
    ]
    return hubs, candidates


def hub_node_ids(session: Session) -> set[int]:
    _, candidates = load_hub_candidates(session)
    return {node for c in candidates for node in c.node_ids}
