from app.geocoding.nearest import StationWalk
from app.transit.matrix import StationTimeMatrix
from app.transit.travel import Leg, travel_minutes

MATRIX = StationTimeMatrix({(1, 2): 35, (5, 2): 33, (1, 3): 45})


def test_picks_cheapest_origin_station():
    nearest = [
        StationWalk(1, "홍대입구", 5, "walk"),
        StationWalk(5, "신촌", 12, "walk"),
    ]
    leg = travel_minutes(nearest, hub_node_ids=[2], matrix=MATRIX)
    assert leg == Leg(
        origin_station_id=1,
        origin_station_name="홍대입구",
        access_minutes=5,
        transit_minutes=35,
        total_minutes=45,
        via="walk",
    )


def test_returns_none_when_no_route():
    nearest = [StationWalk(1, "홍대입구", 5, "walk")]
    assert travel_minutes(nearest, hub_node_ids=[9], matrix=MATRIX) is None


def test_bus_fallback_is_carried_through():
    nearest = [StationWalk(1, "홍대입구", 15, "bus")]
    leg = travel_minutes(nearest, hub_node_ids=[3], matrix=MATRIX)
    assert leg is not None
    assert leg.via == "bus"
    assert leg.total_minutes == 15 + 45 + 5


def test_takes_min_over_multiple_hub_nodes():
    matrix = StationTimeMatrix({(1, 2): 35, (1, 8): 20})
    nearest = [StationWalk(1, "홍대입구", 5, "walk")]
    leg = travel_minutes(nearest, hub_node_ids=[2, 8], matrix=matrix)
    assert leg is not None
    assert leg.transit_minutes == 20
