from collections.abc import Sequence
from dataclasses import dataclass

from app.geo import HUB_EXIT_WALK_MINUTES
from app.geocoding.nearest import StationWalk
from app.transit.matrix import StationTimeMatrix


@dataclass(frozen=True)
class Leg:
    origin_station_id: int
    origin_station_name: str
    access_minutes: int
    transit_minutes: int
    total_minutes: int
    via: str


def travel_minutes(
    nearest: Sequence[StationWalk],
    hub_node_ids: Sequence[int],
    matrix: StationTimeMatrix,
) -> Leg | None:
    best: Leg | None = None
    for origin in nearest:
        for node_id in hub_node_ids:
            transit = matrix.minutes(origin.station_id, node_id)
            if transit is None:
                continue
            total = origin.walk_minutes + transit + HUB_EXIT_WALK_MINUTES
            if best is None or total < best.total_minutes:
                best = Leg(
                    origin_station_id=origin.station_id,
                    origin_station_name=origin.station_name,
                    access_minutes=origin.walk_minutes,
                    transit_minutes=transit,
                    total_minutes=total,
                    via=origin.via,
                )
    return best
