"""모든 역 노드에서 거점 노드까지 최단 소요시간(분)을 계산해 out/station_times.csv를 만든다.

실행: python -m pipeline.times
"""

import heapq
from collections.abc import Iterable

from pipeline.config import MANUAL_DIR, OUT_DIR
from pipeline.io import read_csv_rows, write_csv

TIME_FIELDS = ("from_station_id", "to_station_id", "minutes")


def build_adjacency(edges: Iterable[tuple[int, int, float]]) -> dict[int, list[tuple[int, float]]]:
    adj: dict[int, list[tuple[int, float]]] = {}
    for a, b, w in edges:
        adj.setdefault(a, []).append((b, w))
        adj.setdefault(b, []).append((a, w))
    return adj


def dijkstra(adj: dict[int, list[tuple[int, float]]], source: int) -> dict[int, float]:
    dist = {source: 0.0}
    heap = [(0.0, source)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist.get(u, float("inf")):
            continue
        for v, w in adj.get(u, ()):
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    return dist


def compute_station_times(adj: dict[int, list[tuple[int, float]]], sources: Iterable[int], targets: set[int]) -> list[tuple[int, int, int]]:
    rows: list[tuple[int, int, int]] = []
    for s in sources:
        dist = dijkstra(adj, s)
        for t in sorted(targets):
            if t in dist:
                rows.append((s, t, int(round(dist[t]))))
    return rows


def hub_node_ids(station_rows: Iterable[dict[str, str]], hub_group_ids: set[int]) -> set[int]:
    return {int(r["id"]) for r in station_rows if r["group_id"] and int(r["group_id"]) in hub_group_ids}


def main() -> None:
    stations = read_csv_rows(OUT_DIR / "stations.csv")
    edges = [(int(r["from_id"]), int(r["to_id"]), float(r["minutes"])) for r in read_csv_rows(OUT_DIR / "edges.csv")]
    transfers = [(int(r["from_id"]), int(r["to_id"]), float(r["minutes"])) for r in read_csv_rows(OUT_DIR / "transfers.csv")]
    hub_groups = {int(r["group_id"]) for r in read_csv_rows(MANUAL_DIR / "hubs.csv")}
    targets = hub_node_ids(stations, hub_groups)
    adj = build_adjacency(edges + transfers)
    rows = compute_station_times(adj, [int(r["id"]) for r in stations], targets)
    write_csv(OUT_DIR / "station_times.csv", TIME_FIELDS, [dict(zip(TIME_FIELDS, r)) for r in rows])
    print(f"station_times: {len(rows)} rows for {len(targets)} hub nodes")


if __name__ == "__main__":
    main()
