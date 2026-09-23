from collections.abc import Sequence
from dataclasses import dataclass

from app.geocoding.nearest import StationWalk
from app.transit.matrix import StationTimeMatrix
from app.transit.travel import Leg, travel_minutes


@dataclass(frozen=True)
class ParticipantInput:
    id: int
    nickname: str
    nearest: tuple[StationWalk, ...]


@dataclass(frozen=True)
class HubCandidate:
    hub_id: int
    name: str
    node_ids: tuple[int, ...]


@dataclass(frozen=True)
class ParticipantLeg:
    participant_id: int
    nickname: str
    leg: Leg


@dataclass(frozen=True)
class HubScore:
    hub_id: int
    name: str
    max_minutes: int
    sum_minutes: int
    spread_minutes: int
    legs: tuple[ParticipantLeg, ...]


def _score_hub(
    participants: Sequence[ParticipantInput],
    hub: HubCandidate,
    matrix: StationTimeMatrix,
) -> HubScore | None:
    legs: list[ParticipantLeg] = []
    for p in participants:
        leg = travel_minutes(p.nearest, hub.node_ids, matrix)
        if leg is None:
            return None
        legs.append(ParticipantLeg(p.id, p.nickname, leg))
    totals = [l.leg.total_minutes for l in legs]
    return HubScore(
        hub_id=hub.hub_id,
        name=hub.name,
        max_minutes=max(totals),
        sum_minutes=sum(totals),
        spread_minutes=max(totals) - min(totals),
        legs=tuple(legs),
    )


def rank_hubs(
    participants: Sequence[ParticipantInput],
    hubs: Sequence[HubCandidate],
    matrix: StationTimeMatrix,
    top_n: int = 5,
) -> list[HubScore]:
    scored = [s for h in hubs if (s := _score_hub(participants, h, matrix)) is not None]
    ordered = sorted(scored, key=lambda s: (s.max_minutes, s.sum_minutes, s.hub_id))
    return ordered[:top_n]
