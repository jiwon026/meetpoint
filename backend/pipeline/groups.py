"""물리적으로 같은 역을 그룹으로 묶고 환승 간선을 만든다.

실행: python -m pipeline.groups (stations.csv를 읽고 group_id를 채워 다시 쓴다)
"""

from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass

from app.geo import haversine_km
from pipeline.config import COLUMNS, DEFAULT_TRANSFER_MIN, GROUP_RADIUS_KM, MANUAL_DIR, OUT_DIR, TRANSFER_WAIT_MIN, canonical_line
from pipeline.durations import parse_duration
from pipeline.edges import load_stations
from pipeline.io import pick, read_csv_rows, require_raw, write_csv
from pipeline.names import normalize_station_name
from pipeline.stations import STATION_FIELDS, StationRow, load_aliases

GROUP_FIELDS = ("id", "name", "lat", "lng", "node_count")
TRANSFER_FIELDS = ("from_id", "to_id", "minutes", "source")


@dataclass(frozen=True)
class GroupRow:
    id: int
    name: str
    lat: float
    lng: float
    node_count: int


@dataclass(frozen=True)
class Transfer:
    from_id: int
    to_id: int
    minutes: float
    source: str  # measured 또는 default


class _UnionFind:
    def __init__(self, ids: Iterable[int]) -> None:
        self._parent = {i: i for i in ids}

    def find(self, i: int) -> int:
        while self._parent[i] != i:
            self._parent[i] = self._parent[self._parent[i]]
            i = self._parent[i]
        return i

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self._parent[max(ra, rb)] = min(ra, rb)


def _name_key(name: str, aliases: dict[str, str]) -> str:
    other = aliases.get(name)
    return min(name, other) if other else name


def assign_groups(stations: Sequence[StationRow], aliases: dict[str, str], radius_km: float = GROUP_RADIUS_KM) -> dict[int, int]:
    uf = _UnionFind(s.id for s in stations)
    by_key: dict[str, list[StationRow]] = {}
    for s in stations:
        by_key.setdefault(_name_key(s.name, aliases), []).append(s)
    for members in by_key.values():
        for i, a in enumerate(members):
            for b in members[i + 1 :]:
                if haversine_km(a.lat, a.lng, b.lat, b.lng) <= radius_km:
                    uf.union(a.id, b.id)
    roots = sorted({uf.find(s.id) for s in stations})
    group_id_of_root = {root: i + 1 for i, root in enumerate(roots)}
    return {s.id: group_id_of_root[uf.find(s.id)] for s in stations}


def group_rows(stations: Sequence[StationRow], group_of: dict[int, int]) -> list[GroupRow]:
    members: dict[int, list[StationRow]] = {}
    for s in stations:
        members.setdefault(group_of[s.id], []).append(s)
    rows = []
    for gid in sorted(members):
        ms = members[gid]
        name = Counter(s.name for s in ms).most_common(1)[0][0]
        rows.append(GroupRow(gid, name, round(sum(s.lat for s in ms) / len(ms), 6), round(sum(s.lng for s in ms) / len(ms), 6), len(ms)))
    return rows


SkippedTransfer = tuple[str, str, str, str]  # 원본 (환승역명, 호선, 환승노선, 환승소요시간)


def parse_transfer_minutes(
    rows: Iterable[dict[str, str]],
) -> tuple[dict[tuple[str, str, str], float], list[SkippedTransfer]]:
    """(정규화 역명, 호선, 환승노선) -> 환승 도보 분 표와, 노선이 표준 노선명으로 매핑되지 않거나 분을 읽지 못해 건너뛴 행."""
    cols = COLUMNS["transfer"]
    table: dict[tuple[str, str, str], float] = {}
    skipped: list[SkippedTransfer] = []
    for row in rows:
        raw_line, raw_to_line = pick(row, cols["line"]), pick(row, cols["to_line"])
        raw_minutes = pick(row, cols["minutes"], required=False)
        line, to_line = canonical_line(raw_line), canonical_line(raw_to_line)
        minutes = parse_duration(raw_minutes)
        if line is None or to_line is None or minutes is None:
            skipped.append((pick(row, cols["name"]), raw_line, raw_to_line, raw_minutes))
            continue
        table[(normalize_station_name(pick(row, cols["name"])), line, to_line)] = round(minutes, 1)
    return table, skipped


def build_transfers(stations: Sequence[StationRow], group_of: dict[int, int], minutes_table: dict[tuple[str, str, str], float]) -> list[Transfer]:
    members: dict[int, list[StationRow]] = {}
    for s in stations:
        members.setdefault(group_of[s.id], []).append(s)
    transfers: list[Transfer] = []
    for ms in members.values():
        for i, a in enumerate(ms):
            for b in ms[i + 1 :]:
                measured = minutes_table.get((a.name, a.line, b.line)) or minutes_table.get((b.name, b.line, a.line))
                if measured is not None:
                    transfers.append(Transfer(a.id, b.id, round(measured + TRANSFER_WAIT_MIN, 1), "measured"))
                else:
                    transfers.append(Transfer(a.id, b.id, DEFAULT_TRANSFER_MIN, "default"))
    return transfers


def main() -> None:
    stations = load_stations(OUT_DIR / "stations.csv")
    aliases = load_aliases(MANUAL_DIR / "station_aliases.csv")
    group_of = assign_groups(stations, aliases)
    groups = group_rows(stations, group_of)
    table, skipped = parse_transfer_minutes(read_csv_rows(require_raw("transfers")))
    for name, line, to_line, minutes in skipped:
        print(f"환승 행 건너뜀: {name} {line} -> {to_line} ({minutes})")
    if skipped:
        print(f"환승 행 건너뜀 {len(skipped)}건")
    transfers = build_transfers(stations, group_of, table)
    write_csv(OUT_DIR / "station_groups.csv", GROUP_FIELDS, [asdict(g) for g in groups])
    write_csv(OUT_DIR / "transfers.csv", TRANSFER_FIELDS, [asdict(t) for t in transfers])
    write_csv(OUT_DIR / "stations.csv", STATION_FIELDS, [{**asdict(s), "group_id": group_of[s.id]} for s in stations])
    measured = sum(1 for t in transfers if t.source == "measured")
    print(f"groups: {len(groups)}, transfers: {len(transfers)} ({measured} measured)")


if __name__ == "__main__":
    main()
