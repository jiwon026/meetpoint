from sqlalchemy import select

from app.geocoding.nearest import StationWalk
from app.models import Hub, Station
from app.ranking.rank import HubCandidate, ParticipantInput, rank_hubs
from app.transit.matrix import StationTimeMatrix


def _candidates(seeded):
    stations = seeded.scalars(select(Station)).all()
    hubs = seeded.scalars(select(Hub)).all()
    return [
        HubCandidate(h.id, h.name, tuple(s.id for s in stations if s.name == h.name))
        for h in hubs
    ]


def _participants():
    return [
        ParticipantInput(1, "홍대사는친구", (StationWalk(1, "홍대입구", 5, "walk"),)),
        ParticipantInput(2, "수원사는친구", (StationWalk(6, "수원", 5, "walk"),)),
        ParticipantInput(3, "잠실사는친구", (StationWalk(3, "잠실", 5, "walk"),)),
    ]


def test_fairness_prefers_gangnam_over_jamsil(seeded):
    """잠실은 두 명에게 가깝지만 수원 친구가 80분. 강남이 최대 70분으로 가장 공평하다."""
    matrix = StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    scores = rank_hubs(_participants(), _candidates(seeded), matrix)
    assert [s.name for s in scores] == ["강남", "잠실", "건대입구", "홍대입구"]
    top = scores[0]
    assert top.max_minutes == 70
    assert top.spread_minutes == 70 - 25
    assert {l.nickname: l.leg.total_minutes for l in top.legs} == {
        "홍대사는친구": 45,
        "수원사는친구": 70,
        "잠실사는친구": 25,
    }


def test_top_n_limits_results(seeded):
    matrix = StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    scores = rank_hubs(_participants(), _candidates(seeded), matrix, top_n=2)
    assert len(scores) == 2


def test_tie_on_max_breaks_by_sum():
    matrix = StationTimeMatrix({(1, 10): 30, (2, 10): 30, (1, 11): 30, (2, 11): 10})
    participants = [
        ParticipantInput(1, "a", (StationWalk(1, "A", 0, "walk"),)),
        ParticipantInput(2, "b", (StationWalk(2, "B", 0, "walk"),)),
    ]
    hubs = [HubCandidate(10, "같은최대_합큼", (10,)), HubCandidate(11, "같은최대_합작음", (11,))]
    scores = rank_hubs(participants, hubs, matrix)
    assert [s.hub_id for s in scores] == [11, 10]


def test_hub_unreachable_by_anyone_is_dropped():
    matrix = StationTimeMatrix({(1, 10): 30})
    participants = [
        ParticipantInput(1, "a", (StationWalk(1, "A", 0, "walk"),)),
        ParticipantInput(2, "b", (StationWalk(2, "B", 0, "walk"),)),
    ]
    hubs = [HubCandidate(10, "b는못감", (10,))]
    assert rank_hubs(participants, hubs, matrix) == []
