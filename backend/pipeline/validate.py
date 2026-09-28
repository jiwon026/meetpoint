"""out/ 산출물이 적재 가능한 상태인지 검사한다. 문제가 하나라도 있으면 종료 코드 1.

실행: python -m pipeline.validate
"""

import sys
from collections.abc import Iterable, Sequence

from pipeline.config import MANUAL_DIR, MAX_EDGE_KM, METRO_LAT_RANGE, METRO_LNG_RANGE, OUT_DIR
from pipeline.edges import load_line_classes
from pipeline.io import read_csv_rows
from pipeline.times import build_adjacency, dijkstra, hub_node_ids

# (출발 그룹 이름, 도착 그룹 이름, 최소 분, 최대 분)
SANITY_CASES = [
    ("홍대입구", "강남", 30, 45),
    ("잠실", "강남", 12, 20),
    ("수원", "강남", 50, 75),
    ("부평", "서울", 45, 70),
    ("판교", "강남", 15, 30),
]


def check_bbox(stations: Iterable[dict[str, str]]) -> list[str]:
    out = []
    for s in stations:
        lat, lng = float(s["lat"]), float(s["lng"])
        if not (METRO_LAT_RANGE[0] <= lat <= METRO_LAT_RANGE[1] and METRO_LNG_RANGE[0] <= lng <= METRO_LNG_RANGE[1]):
            out.append(f"경계 밖: {s['name']} ({s['line']}) {lat},{lng}")
    return out


def check_edge_lengths(edges: Iterable[dict[str, str]], classes: dict[str, str]) -> list[str]:
    out = []
    for e in edges:
        limit = MAX_EDGE_KM[classes.get(e["line"], "urban")]
        if float(e["km"]) > limit:
            out.append(f"간선 거리 초과: {e['line']} {e['from_id']}-{e['to_id']} {e['km']}km > {limit}km")
    return out


def check_connectivity(station_ids: Sequence[int], edges: Iterable[dict[str, str]], transfers: Iterable[dict[str, str]]) -> list[str]:
    links = [(int(r["from_id"]), int(r["to_id"]), 1.0) for r in list(edges) + list(transfers)]
    adj = build_adjacency(links)
    remaining = set(station_ids)
    components: list[set[int]] = []
    while remaining:
        start = min(remaining)
        reached = set(dijkstra(adj, start))
        components.append(reached & remaining or {start})
        remaining -= reached | {start}
    if len(components) <= 1:
        return []
    components.sort(key=len, reverse=True)
    return [f"연결 성분 {len(components)}개. 크기: {[len(c) for c in components]}. 작은 성분 예시 노드: {sorted(components[1])[:5]}"]


def check_hubs_have_nodes(hubs: Iterable[dict[str, str]], stations: Iterable[dict[str, str]]) -> list[str]:
    groups_with_nodes = {int(s["group_id"]) for s in stations if s["group_id"]}
    return [f"거점에 노드 없음: {h['name']} (group {h['group_id']})" for h in hubs if int(h["group_id"]) not in groups_with_nodes]


def check_times_complete(stations: Iterable[dict[str, str]], hub_nodes: set[int], times: Iterable[dict[str, str]]) -> list[str]:
    have = {(int(t["from_station_id"]), int(t["to_station_id"])) for t in times}
    out = []
    for s in stations:
        for h in sorted(hub_nodes):
            if (int(s["id"]), h) not in have:
                out.append(f"시간표 누락: {s['id']} -> {h}")
    return out


def _group_nodes(groups: Iterable[dict[str, str]], stations: Iterable[dict[str, str]]) -> dict[str, list[int]]:
    name_of_group = {int(g["id"]): g["name"] for g in groups}
    out: dict[str, list[int]] = {}
    for s in stations:
        if s["group_id"]:
            out.setdefault(name_of_group[int(s["group_id"])], []).append(int(s["id"]))
    return out


def check_sanity(groups, stations, times_lookup: dict[tuple[int, int], int], cases) -> list[str]:
    nodes = _group_nodes(groups, stations)
    out = []
    for src, dst, lo, hi in cases:
        candidates = [times_lookup[(a, b)] for a in nodes.get(src, []) for b in nodes.get(dst, []) if (a, b) in times_lookup]
        if not candidates:
            out.append(f"상식 검증 불가: {src} -> {dst} 시간 없음")
            continue
        best = min(candidates)
        if not (lo <= best <= hi):
            out.append(f"상식 검증 실패: {src} -> {dst} {best}분 (기대 {lo}~{hi})")
    return out


def report_same_name_groups(groups: Iterable[dict[str, str]]) -> list[str]:
    by_name: dict[str, list[int]] = {}
    for g in groups:
        by_name.setdefault(g["name"], []).append(int(g["id"]))
    return [f"{name}: groups {sorted(ids)}" for name, ids in sorted(by_name.items()) if len(ids) > 1]


def run_all_checks() -> list[str]:
    stations = read_csv_rows(OUT_DIR / "stations.csv")
    groups = read_csv_rows(OUT_DIR / "station_groups.csv")
    edges = read_csv_rows(OUT_DIR / "edges.csv")
    transfers = read_csv_rows(OUT_DIR / "transfers.csv")
    times = read_csv_rows(OUT_DIR / "station_times.csv")
    hubs = read_csv_rows(MANUAL_DIR / "hubs.csv")
    classes = load_line_classes(MANUAL_DIR / "line_classes.csv")
    hub_nodes = hub_node_ids(stations, {int(h["group_id"]) for h in hubs})
    lookup = {(int(t["from_station_id"]), int(t["to_station_id"])): int(t["minutes"]) for t in times}
    problems = []
    problems += check_bbox(stations)
    problems += check_edge_lengths(edges, classes)
    problems += check_connectivity([int(s["id"]) for s in stations], edges, transfers)
    problems += check_hubs_have_nodes(hubs, stations)
    problems += check_times_complete(stations, hub_nodes, times)
    problems += check_sanity(groups, stations, lookup, SANITY_CASES)
    for line in report_same_name_groups(groups):
        print("참고(같은 이름 다른 그룹):", line)
    return problems


if __name__ == "__main__":
    found = run_all_checks()
    for p in found[:200]:
        print("FAIL:", p)
    if found:
        print(f"검증 실패 {len(found)}건")
        sys.exit(1)
    print("검증 통과")
