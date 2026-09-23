import math

EARTH_RADIUS_KM = 6371.0
WALK_KMH = 4.0
WALK_DETOUR = 1.3
MAX_WALK_KM = 2.0
BUS_FALLBACK_MINUTES = 15
HUB_EXIT_WALK_MINUTES = 5

# 수도권 대략 경계 (서울, 경기, 인천)
METRO_LAT_RANGE = (36.9, 38.3)
METRO_LNG_RANGE = (126.3, 127.9)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def walk_minutes(km: float) -> int:
    return math.ceil(km * WALK_DETOUR / WALK_KMH * 60)


def round_coord(value: float) -> float:
    return round(value, 3)


def is_in_metro(lat: float, lng: float) -> bool:
    lat_ok = METRO_LAT_RANGE[0] <= lat <= METRO_LAT_RANGE[1]
    lng_ok = METRO_LNG_RANGE[0] <= lng <= METRO_LNG_RANGE[1]
    return lat_ok and lng_ok
