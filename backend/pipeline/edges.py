"""노선별 역 순서 파일 3종을 읽어 인접 간선(out/edges.csv)을 만든다.

실행: python -m pipeline.edges
"""

from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path

from app.geo import haversine_km
from pipeline.config import (
    COLUMNS,
    HAVERSINE_DETOUR,
    KRAIL_DISTANCE_GLOB,
    MANUAL_DIR,
    OUT_DIR,
    RAW_DIR,
    canonical_line,
)
from pipeline.estimate import estimate_minutes
from pipeline.io import pick, read_csv_rows, require_raw, write_csv
from pipeline.names import normalize_station_name
from pipeline.stations import StationRow

EDGE_FIELDS = ("from_id", "to_id", "line", "km", "minutes", "source")
Segment = list[tuple[str, float | None, float | None]]  # (역명, 직전 역까지 km, 직전 역까지 분)


@dataclass(frozen=True)
class Edge:
    from_id: int
    to_id: int
    line: str
    km: float
    minutes: float
    source: str  # measured 또는 estimated


class MatchError(Exception):
    def __init__(self, unmatched: list[tuple[str, str]]) -> None:
        self.unmatched = unmatched
        lines = "\n".join(f"  {line}: {name}" for line, name in unmatched)
        super().__init__(f"역명 매칭 실패 {len(unmatched)}건:\n{lines}")


class StationIndex:
    def __init__(self, stations: Sequence[StationRow], aliases: dict[str, str]) -> None:
        self._by_key = {(s.name, s.line): s for s in stations}
        self._alias = dict(aliases)

    def get(self, name: str, line: str) -> StationRow | None:
        norm = normalize_station_name(name)
        for candidate in (norm, self._alias.get(norm, norm)):
            hit = self._by_key.get((candidate, line))
            if hit is not None:
                return hit
        return None


def parse_duration(value: str) -> float | None:
    """'2', '1.5', '02:00', '01:30' 을 분(float)으로. 빈 값이나 이상한 값은 None.

    서울교통공사 파일의 소요시간과 환승소요시간은 mm:ss 형식이다.
    """
    value = value.strip()
    if not value:
        return None
    if ":" in value:
        m, s = value.split(":", 1)
        try:
            return float(m) + float(s) / 60
        except ValueError:
            return None
    try:
        return float(value)
    except ValueError:
        return None


_to_float = parse_duration


def _append(segments: dict[str, list[Segment]], line: str, name: str, km: float | None, minutes: float | None, new_segment: bool) -> None:
    segs = segments.setdefault(line, [])
    if new_segment or not segs:
        segs.append([(name, None, None)])
    else:
        segs[-1].append((name, km, minutes))


def parse_seoul_segments(rows: Iterable[dict[str, str]]) -> dict[str, list[Segment]]:
    cols = COLUMNS["seoul"]
    segments: dict[str, list[Segment]] = {}
    for row in rows:
        line = canonical_line(pick(row, cols["line"]))
        if line is None:
            continue
        km = _to_float(pick(row, cols["km"], required=False))
        minutes = _to_float(pick(row, cols["minutes"], required=False))
        starts = not minutes and not km
        _append(segments, line, pick(row, cols["name"]), km, minutes, starts)
    return segments


def parse_krail_segments(rows: Iterable[dict[str, str]]) -> dict[str, list[Segment]]:
    cols = COLUMNS["krail"]
    segments: dict[str, list[Segment]] = {}
    for row in rows:
        line = canonical_line(pick(row, cols["line"]))
        if line is None:
            continue
        km = _to_float(pick(row, cols["km"], required=False))
        _append(segments, line, pick(row, cols["name"]), km, None, not km)
    return segments


def parse_manual_segments(rows: Iterable[dict[str, str]]) -> dict[str, list[Segment]]:
    ordered = sorted(rows, key=lambda r: (r["line"], int(r["seq"])))
    segments: dict[str, list[Segment]] = {}
    for row in ordered:
        line = canonical_line(row["line"]) or row["line"]
        _append(segments, line, row["name"], None, None, False)
    return segments


def build_edges(
    segments_by_line: dict[str, list[Segment]], index: StationIndex, classes: dict[str, str]
) -> list[Edge]:
    edges: list[Edge] = []
    unmatched: list[tuple[str, str]] = []
    seen: set[tuple[int, int]] = set()
    for line, segments in segments_by_line.items():
        for segment in segments:
            resolved = []
            for name, km, minutes in segment:
                station = index.get(name, line)
                if station is None:
                    unmatched.append((line, name))
                resolved.append((station, km, minutes))
            if unmatched:
                continue
            for (prev, _, _), (cur, km, minutes) in zip(resolved, resolved[1:]):
                a, b = sorted((prev.id, cur.id))
                if (a, b) in seen:
                    continue
                seen.add((a, b))
                distance = km if km else round(haversine_km(prev.lat, prev.lng, cur.lat, cur.lng) * HAVERSINE_DETOUR, 2)
                if minutes:
                    edges.append(Edge(a, b, line, distance, round(minutes, 1), "measured"))
                else:
                    edges.append(Edge(a, b, line, distance, estimate_minutes(distance, classes[line]), "estimated"))
    if unmatched:
        raise MatchError(unmatched)
    return edges


def load_line_classes(path: Path) -> dict[str, str]:
    return {r["line"]: r["line_class"] for r in read_csv_rows(path)}


def load_aliases(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for r in read_csv_rows(path):
        out[r["a"]] = r["b"]
        out[r["b"]] = r["a"]
    return out


def load_stations(path: Path) -> list[StationRow]:
    return [
        StationRow(int(r["id"]), r["name"], r["raw_name"], r["line"], r["operator"], float(r["lat"]), float(r["lng"]), r["region"])
        for r in read_csv_rows(path)
    ]


def _merge(*parts: dict[str, list[Segment]]) -> dict[str, list[Segment]]:
    merged: dict[str, list[Segment]] = {}
    for part in parts:
        for line, segs in part.items():
            merged.setdefault(line, []).extend(segs)
    return merged


def main() -> None:
    stations = load_stations(OUT_DIR / "stations.csv")
    index = StationIndex(stations, load_aliases(MANUAL_DIR / "station_aliases.csv"))
    classes = load_line_classes(MANUAL_DIR / "line_classes.csv")
    seoul = parse_seoul_segments(read_csv_rows(require_raw("seoul_times")))
    krail_rows = [row for p in sorted(RAW_DIR.glob(KRAIL_DISTANCE_GLOB)) for row in read_csv_rows(p)]
    krail = parse_krail_segments(krail_rows)
    # 1~8호선은 서울교통공사 실측을 우선한다. 국가철도공단 파일의 같은 노선 구간은 뺀다.
    krail = {line: segs for line, segs in krail.items() if line not in seoul}
    manual = parse_manual_segments(read_csv_rows(MANUAL_DIR / "line_orders.csv"))
    edges = build_edges(_merge(seoul, krail, manual), index, classes)
    write_csv(OUT_DIR / "edges.csv", EDGE_FIELDS, [asdict(e) for e in edges])
    measured = sum(1 for e in edges if e.source == "measured")
    print(f"edges: {len(edges)} rows ({measured} measured) -> {OUT_DIR / 'edges.csv'}")


if __name__ == "__main__":
    main()
