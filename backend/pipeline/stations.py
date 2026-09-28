"""표준데이터 XLSX에서 수도권 역 노드를 뽑아 out/stations.csv를 만든다.

실행: python -m pipeline.stations
"""

from dataclasses import asdict, dataclass

from pipeline.config import COLUMNS, METRO_LAT_RANGE, METRO_LNG_RANGE, OUT_DIR, canonical_line
from pipeline.io import pick, read_xlsx_rows, require_raw, write_csv
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
    seen: set[tuple[str, str]] = set()
    for row in rows:
        line = canonical_line(pick(row, cols["line"]))
        if line is None:
            continue
        try:
            lat, lng = float(pick(row, cols["lat"])), float(pick(row, cols["lng"]))
        except ValueError:
            continue
        if not _in_metro(lat, lng):
            continue
        raw_name = pick(row, cols["name"])
        name = normalize_station_name(raw_name)
        key = (name, line)
        if key in seen:
            continue
        seen.add(key)
        out.append(
            StationRow(
                id=len(out) + 1,
                name=name,
                raw_name=raw_name,
                line=line,
                operator=pick(row, cols["operator"], required=False),
                lat=lat,
                lng=lng,
                region=region_from_address(pick(row, cols["address"], required=False)),
            )
        )
    return out


def main() -> None:
    rows = read_xlsx_rows(require_raw("stations_std"))
    stations = parse_standard(rows)
    write_csv(OUT_DIR / "stations.csv", STATION_FIELDS, [{**asdict(s), "group_id": ""} for s in stations])
    print(f"stations: {len(stations)} rows -> {OUT_DIR / 'stations.csv'}")


if __name__ == "__main__":
    main()
