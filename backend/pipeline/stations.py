"""표준데이터 XLSX에서 수도권 역 노드를 뽑아 out/stations.csv를 만든다.

실행: python -m pipeline.stations
"""

from collections.abc import Collection, Mapping
from dataclasses import asdict, dataclass
from pathlib import Path

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


def load_aliases(path: Path) -> dict[str, str]:
    """station_aliases.csv(a, b)를 양방향 정규화 역명 맵으로."""
    out: dict[str, str] = {}
    for r in read_csv_rows(path):
        out[r["a"]] = r["b"]
        out[r["b"]] = r["a"]
    return out


def parse_standard(rows: list[dict[str, str]], aliases: Mapping[str, str] | None = None) -> list[StationRow]:
    """표준데이터 행을 수도권 역 노드로. 같은 노선에서 이름이 같거나 aliases(정규화 역명 쌍)로 이어진 행은 한 노드다.

    수도권 노선인데 좌표를 읽지 못한 행이 있으면 목록을 담아 ValueError. 수도권 밖 노선 행은 무시한다.
    """
    cols = COLUMNS["std"]
    aliases = aliases or {}
    out: list[StationRow] = []
    seen: dict[tuple[str, str], StationRow] = {}
    bad_coords: list[tuple[str, str, str, str]] = []
    for row in rows:
        raw_line = pick(row, cols["line"]).strip()
        raw_name = pick(row, cols["name"])
        name = normalize_station_name(raw_name)
        line = STD_LINE_OVERRIDES.get((raw_line, name)) or canonical_line(raw_line)
        if line is None:
            continue
        raw_lat, raw_lng = pick(row, cols["lat"]), pick(row, cols["lng"])
        try:
            lat, lng = float(raw_lat), float(raw_lng)
        except ValueError:
            bad_coords.append((raw_name, line, raw_lat, raw_lng))
            continue
        lat, lng = STD_COORD_OVERRIDES.get((line, name), (lat, lng))
        if not _in_metro(lat, lng):
            continue
        other = aliases.get(name)
        key = (min(name, other) if other else name, line)
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
    if bad_coords:
        raise ValueError(f"좌표를 읽지 못한 수도권 역 {len(bad_coords)}건 (역사명, 노선, 위도, 경도): {bad_coords}")
    return out


def parse_extra(
    rows: list[dict[str, str]], start_id: int, existing: Collection[tuple[str, str]] = ()
) -> list[StationRow]:
    """표준데이터에 없는 역(manual/extra_stations.csv)을 id를 이어 붙여 StationRow로.

    노선이 표준 노선명이 아니거나, 좌표가 수도권 범위 밖이거나, (이름, 노선)이 existing(표준데이터 노드)이나
    파일 앞 행에 이미 있으면 ValueError. 수작업 파일 실수가 조용히 노드로 들어가지 않게 한다.
    """
    seen = set(existing)
    out: list[StationRow] = []
    for r in rows:
        line = canonical_line(r["line"])
        if line is None:
            raise ValueError(f"extra_stations: 표준 노선명이 아닌 노선 {r['line']!r} ({r['name']})")
        lat, lng = float(r["lat"]), float(r["lng"])
        if not _in_metro(lat, lng):
            raise ValueError(f"extra_stations: 수도권 범위 밖 좌표 {r['name']} {line} {lat},{lng}")
        name = normalize_station_name(r["name"])
        if (name, line) in seen:
            raise ValueError(f"extra_stations: 이미 있는 역 ({name}, {line})")
        seen.add((name, line))
        out.append(StationRow(start_id + len(out), name, r["name"], line, r["operator"], lat, lng, r["region"]))
    return out


def main() -> None:
    rows = read_xlsx_rows(require_raw("stations_std"))
    stations = parse_standard(rows, load_aliases(MANUAL_DIR / "station_aliases.csv"))
    extra_path = MANUAL_DIR / "extra_stations.csv"
    if extra_path.exists():
        existing = {(st.name, st.line) for st in stations}
        stations += parse_extra(read_csv_rows(extra_path), start_id=len(stations) + 1, existing=existing)
    write_csv(OUT_DIR / "stations.csv", STATION_FIELDS, [{**asdict(s), "group_id": ""} for s in stations])
    print(f"stations: {len(stations)} rows -> {OUT_DIR / 'stations.csv'}")


if __name__ == "__main__":
    main()
