from collections.abc import Sequence
from dataclasses import dataclass

from app.geocoding.nearest import StationWalk
from app.transit.matrix import StationTimeMatrix
from app.transit.travel import Leg, travel_minutes

# 테마에 맞는 거점을 앞에 둘 때 공평함을 양보하는 한도(분). 측정값이 아니라 고른 값. 근거는 data/SOURCES.md.
THEME_TOLERANCE_MINUTES = 5


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


@dataclass(frozen=True)
class Ranking:
    best_max_minutes: int | None
    scores: tuple[HubScore, ...]


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


def rank_with_preference(
    participants: Sequence[ParticipantInput],
    hubs: Sequence[HubCandidate],
    matrix: StationTimeMatrix,
    top_n: int = 5,
    preferred_hub_ids: frozenset[int] = frozenset(),
    tolerance_minutes: int = THEME_TOLERANCE_MINUTES,
) -> Ranking:
    """공평함 순위. 선호 거점은 가장 빠른 곳보다 tolerance_minutes 이내로만 느릴 때 앞에 둔다."""
    scored = [s for h in hubs if (s := _score_hub(participants, h, matrix)) is not None]
    if not scored:
        return Ranking(None, ())
    best = min(s.max_minutes for s in scored)

    def key(s: HubScore) -> tuple[int, int, int, int]:
        preferred = s.hub_id in preferred_hub_ids and s.max_minutes <= best + tolerance_minutes
        return (0 if preferred else 1, s.max_minutes, s.sum_minutes, s.hub_id)

    return Ranking(best, tuple(sorted(scored, key=key)[:top_n]))


def rank_hubs(
    participants: Sequence[ParticipantInput],
    hubs: Sequence[HubCandidate],
    matrix: StationTimeMatrix,
    top_n: int = 5,
) -> list[HubScore]:
    return list(rank_with_preference(participants, hubs, matrix, top_n).scores)
