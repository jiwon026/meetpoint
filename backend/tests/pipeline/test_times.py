from pipeline.times import build_adjacency, compute_station_times, dijkstra, hub_node_ids

# 1-2-3 선형, 3과 4는 환승(3분), 4-5 선형, 6은 고립
EDGES = [(1, 2, 2.0), (2, 3, 2.5), (4, 5, 3.0), (3, 4, 3.0)]


def test_adjacency_is_bidirectional():
    adj = build_adjacency(EDGES)
    assert (1, 2.0) in adj[2] and (2, 2.0) in adj[1]


def test_dijkstra_sums_transfer_and_ride():
    dist = dijkstra(build_adjacency(EDGES), 1)
    assert dist[5] == 2.0 + 2.5 + 3.0 + 3.0
    assert 6 not in dist


def test_compute_station_times_rounds_and_skips_unreachable():
    adj = build_adjacency(EDGES + [(6, 6, 0.0)])
    rows = compute_station_times(adj, sources=[1, 6], targets={5, 1})
    assert (1, 5, 10) in rows or (1, 5, 11) in rows
    assert (1, 1, 0) in rows
    assert all(r[0] != 6 or r[1] == 6 for r in rows)


def test_hub_node_ids_selects_nodes_in_hub_groups():
    stations = [
        {"id": "1", "group_id": "10"},
        {"id": "2", "group_id": "10"},
        {"id": "3", "group_id": "11"},
    ]
    assert hub_node_ids(stations, {10}) == {1, 2}
