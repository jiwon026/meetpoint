"""표준데이터 XLSX에서 수도권 역 노드를 뽑아 out/stations.csv를 만든다.

실행: python -m pipeline.stations
"""

from dataclasses import asdict, dataclass

from app.geo import haversine_km
from pipeline.config import (
    COLUMNS,
    GROUP_RADIUS_KM,
    MANUAL_DIR,
    METRO_LAT_RANGE,
    METRO_LNG_RANGE,
    OUT_DIR,
    STD_COORD_OVERRIDES,
    STD_LINE_OVERRIDES,
    canonical_line,
)
from pipeline.io import pick, read_csv_rows, read_xlsx_rows, require_raw, write_csv
from pipeline.names import normalize_station_name

STATION_FIELDS = ("id", "name", "raw_name", "line", "operator", "lat", "lng", "region", "group_id")
_REGION_PREFIX = {"서울": "서울", "경기": "경기", "인천": "인천"}


@dataclass(frozen=True)
class StationRow:
    id: int
    name: str
    raw_name: str
    line: str
    operator: str
    lat: float
    lng: float
    region: str


def region_from_address(address: str) -> str:
    return _REGION_PREFIX.get(address.strip()[:2], "")


def _in_metro(lat: float, lng: float) -> bool:
    return METRO_LAT_RANGE[0] <= lat <= METRO_LAT_RANGE[1] and METRO_LNG_RANGE[0] <= lng <= METRO_LNG_RANGE[1]


def parse_standard(rows: list[dict[str, str]]) -> list[StationRow]:
    cols = COLUMNS["std"]
    out: list[StationRow] = []
    seen: dict[tuple[str, str], StationRow] = {}
    for row in rows:
        raw_line = pick(row, cols["line"]).strip()
        raw_name = pick(row, cols["name"])
        name = normalize_station_name(raw_name)
        line = STD_LINE_OVERRIDES.get((raw_line, name)) or canonical_line(raw_line)
        if line is None:
            continue
        try:
            lat, lng = float(pick(row, cols["lat"])), float(pick(row, cols["lng"]))
        except ValueError:
            continue
        lat, lng = STD_COORD_OVERRIDES.get((line, name), (lat, lng))
        if not _in_metro(lat, lng):
            continue
        key = (name, line)
        if key in seen:
            kept = seen[key]
            dist = haversine_km(kept.lat, kept.lng, lat, lng)
            if dist > GROUP_RADIUS_KM:
                raise ValueError(f"중복 역인데 좌표가 다름: {key} {kept.lat},{kept.lng} vs {lat},{lng}")
            continue
        station = StationRow(
            id=len(out) + 1,
            name=name,
            raw_name=raw_name,
            line=line,
            operator=pick(row, cols["operator"], required=False),
            lat=lat,
            lng=lng,
            region=region_from_address(pick(row, cols["address"], required=False)),
        )
        seen[key] = station
        out.append(station)
    return out


def parse_extra(rows: list[dict[str, str]], start_id: int) -> list[StationRow]:
    """표준데이터에 없는 역(manual/extra_stations.csv)을 id를 이어 붙여 StationRow로."""
    return [
        StationRow(
            id=start_id + i,
            name=normalize_station_name(r["name"]),
            raw_name=r["name"],
            line=canonical_line(r["line"]) or r["line"],
            operator=r["operator"],
            lat=float(r["lat"]),
            lng=float(r["lng"]),
            region=r["region"],
        )
        for i, r in enumerate(rows)
    ]


def main() -> None:
    rows = read_xlsx_rows(require_raw("stations_std"))
    stations = parse_standard(rows)
    extra_path = MANUAL_DIR / "extra_stations.csv"
    if extra_path.exists():
        stations += parse_extra(read_csv_rows(extra_path), start_id=len(stations) + 1)
    write_csv(OUT_DIR / "stations.csv", STATION_FIELDS, [{**asdict(s), "group_id": ""} for s in stations])
    print(f"stations: {len(stations)} rows -> {OUT_DIR / 'stations.csv'}")


if __name__ == "__main__":
    main()
