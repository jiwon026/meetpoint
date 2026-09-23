from collections.abc import Sequence
from dataclasses import dataclass

from app.geo import BUS_FALLBACK_MINUTES, MAX_WALK_KM, haversine_km, walk_minutes
from app.models import Station


@dataclass(frozen=True)
class StationWalk:
    station_id: int
    station_name: str
    walk_minutes: int
    via: str  # "walk" 또는 "bus"


def nearest_stations(
    lat: float, lng: float, stations: Sequence[Station], k: int = 3
) -> list[StationWalk]:
    if not stations:
        return []
    by_distance = sorted(
        ((haversine_km(lat, lng, s.lat, s.lng), s) for s in stations),
        key=lambda pair: pair[0],
    )
    within = [(km, s) for km, s in by_distance if km <= MAX_WALK_KM][:k]
    if within:
        return [
            StationWalk(s.id, s.name, walk_minutes(km), "walk") for km, s in within
        ]
    _, closest = by_distance[0]
    return [StationWalk(closest.id, closest.name, BUS_FALLBACK_MINUTES, "bus")]
