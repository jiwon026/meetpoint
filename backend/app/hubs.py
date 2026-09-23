from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Hub
from app.ranking.rank import HubCandidate
from app.stations import all_stations


def load_hub_candidates(session: Session) -> tuple[list[Hub], list[HubCandidate]]:
    """거점과 그 거점에 해당하는 역 노드 id 묶음. 지금은 역 이름으로 묶는다.

    같은 이름의 다른 역(신촌 2호선과 경의중앙선 등)을 구분하려면
    데이터 파이프라인에서 그룹 키를 도입해야 한다. 그때 이 함수만 바꾼다.
    """
    hubs = list(session.scalars(select(Hub).order_by(Hub.id)).all())
    nodes_by_name: dict[str, list[int]] = {}
    for s in all_stations(session):
        nodes_by_name.setdefault(s.name, []).append(s.id)
    candidates = [HubCandidate(h.id, h.name, tuple(nodes_by_name.get(h.name, ()))) for h in hubs]
    return hubs, candidates


def hub_node_ids(session: Session) -> set[int]:
    _, candidates = load_hub_candidates(session)
    return {node for c in candidates for node in c.node_ids}
