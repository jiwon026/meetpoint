"""노선별 역 순서 파일 3종을 읽어 인접 간선(out/edges.csv)을 만든다.

실행: python -m pipeline.edges
"""

from collections.abc import Collection, Iterable, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path

from app.geo import haversine_km
from pipeline.config import (
    COLUMNS,
    HAVERSINE_DETOUR,
    KRAIL_DISTANCE_GLOB,
    KRAIL_EXCLUDE,
    KRAIL_KM_TO_NEXT,
    KRAIL_OUT_OF_AREA,
    KM_MIN_STRAIGHT_RATIO,
    MANUAL_DIR,
    OUT_DIR,
    RAW_DIR,
    SEGMENT_PATCHES,
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


def parse_krail_segments(
    rows: Iterable[dict[str, str]], km_to_next: bool = False, skip_names: Collection[str] = ()
) -> dict[str, list[Segment]]:
    """국가철도공단 역간거리 행을 구간으로. 선명이나 운영기관이 바뀌면 새 구간이다.

    km_to_next=False: 역간거리는 직전 역부터의 거리이고, 0이나 빈 값이면 새 구간을 시작한다.
    km_to_next=True: 역간거리는 다음 역까지의 거리라 다음 행으로 넘긴다. 빈 값은 거리 미상일 뿐 구간 끝이 아니다.
    skip_names(정규화 이름)에 든 역 행은 건너뛰고, 그 자리에서 구간을 끊는다.
    """
    cols = COLUMNS["krail"]
    segments: dict[str, list[Segment]] = {}
    prev_label: tuple[str, str] | None = None
    prev_km: float | None = None
    for row in rows:
        label = (pick(row, cols["operator"], required=False), pick(row, cols["line"]))
        name = pick(row, cols["name"])
        line = canonical_line(label[1])
        if line is None or normalize_station_name(name) in skip_names:
            prev_label = None
            continue
        km = _to_float(pick(row, cols["km"], required=False))
        new_label = label != prev_label
        if km_to_next:
            _append(segments, line, name, None if new_label else prev_km, None, new_label)
        else:
            _append(segments, line, name, km, None, new_label or not km)
        prev_label, prev_km = label, km
    return segments


def parse_manual_segments(rows: Iterable[dict[str, str]]) -> dict[str, list[Segment]]:
    ordered = sorted(rows, key=lambda r: (r["line"], int(r["seq"])))
    segments: dict[str, list[Segment]] = {}
    for row in ordered:
        line = canonical_line(row["line"]) or row["line"]
        _append(segments, line, row["name"], None, None, False)
    return segments


SEGMENT_BREAK = "|"


def apply_segment_patches(
    segments_by_line: dict[str, list[Segment]], patches: dict[tuple[str, str, str], tuple[str, ...]]
) -> dict[str, list[Segment]]:
    """config.SEGMENT_PATCHES 규칙으로 원본 역 순서의 결함을 고친 새 구간 목록을 돌려준다.

    키 (노선, 앞 역, 뒤 역)이 연속한 두 역과 맞으면 그 사이에 값의 역들을 끼우고, "|"에서 구간을 끊는다.
    앞 역이 ""이면 구간 첫 역 앞에 끼운다. 한 번도 쓰이지 않은 규칙이 있으면 원본이 바뀐 것이므로 실패한다.
    """
    used: set[tuple[str, str, str]] = set()
    out: dict[str, list[Segment]] = {}
    for line, segments in segments_by_line.items():
        new_segments: list[Segment] = []
        for segment in segments:
            current: Segment = []
            prev = ""
            for name, km, minutes in segment:
                norm = normalize_station_name(name)
                key = (line, prev, norm)
                if key in patches:
                    used.add(key)
                    for inserted in patches[key]:
                        if inserted == SEGMENT_BREAK:
                            if current:
                                new_segments.append(current)
                            current = []
                        else:
                            current.append((inserted, None, None))
                current.append((name, km, minutes) if current else (name, None, None))
                prev = norm
            new_segments.append(current)
        out[line] = new_segments
    unused = sorted(set(patches) - used)
    if unused:
        raise ValueError(f"쓰이지 않은 SEGMENT_PATCHES 규칙: {unused}")
    return out


def drop_implausible_km(
    segments_by_line: dict[str, list[Segment]], index: StationIndex, min_ratio: float = KM_MIN_STRAIGHT_RATIO
) -> dict[str, list[Segment]]:
    """실측 분이 없는 구간의 km가 두 역 직선거리 x min_ratio보다 짧으면 버린 새 구간 목록을 돌려준다.

    코레일 통합 파일은 1호선 서울교통공사 구간을 빼면서 뒤쪽 행의 거리가 한 칸씩 밀려 있다. 버린 km는
    build_edges가 직선거리 x HAVERSINE_DETOUR로 채운다. 역 매칭 실패는 build_edges가 보고하므로 여기선 넘긴다.
    """
    out: dict[str, list[Segment]] = {}
    for line, segments in segments_by_line.items():
        new_segments: list[Segment] = []
        for segment in segments:
            fixed: Segment = segment[:1]
            for (prev_name, _, _), (name, km, minutes) in zip(segment, segment[1:]):
                a, b = index.get(prev_name, line), index.get(name, line)
                if km and minutes is None and a and b and km < min_ratio * haversine_km(a.lat, a.lng, b.lat, b.lng):
                    km = None
                fixed.append((name, km, minutes))
            new_segments.append(fixed)
        out[line] = new_segments
    return out


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
            if any(st is None for st, _, _ in resolved):
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
    krail_paths = [p for p in sorted(RAW_DIR.glob(KRAIL_DISTANCE_GLOB)) if p.name not in KRAIL_EXCLUDE]
    krail = _merge(
        *(
            parse_krail_segments(read_csv_rows(p), km_to_next=p.name in KRAIL_KM_TO_NEXT, skip_names=KRAIL_OUT_OF_AREA)
            for p in krail_paths
        )
    )
    manual = parse_manual_segments(read_csv_rows(MANUAL_DIR / "line_orders.csv"))
    # 노선으로 거르지 않는다. 서울교통공사 실측 구간이 먼저 들어가므로 같은 역 쌍은 build_edges의
    # (a, b) 중복 제거로 실측이 남고, 국가철도공단 파일은 1호선 코레일 구간처럼 서울 파일에 없는 쌍만 보탠다.
    segments = apply_segment_patches(_merge(seoul, krail, manual), SEGMENT_PATCHES)
    edges = build_edges(drop_implausible_km(segments, index), index, classes)
    write_csv(OUT_DIR / "edges.csv", EDGE_FIELDS, [asdict(e) for e in edges])
    measured = sum(1 for e in edges if e.source == "measured")
    print(f"edges: {len(edges)} rows ({measured} measured) -> {OUT_DIR / 'edges.csv'}")


if __name__ == "__main__":
    main()
