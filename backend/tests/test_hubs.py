from app.hubs import hub_node_ids, load_hub_candidates


def test_hub_node_ids_covers_every_hub_station(seeded):
    assert hub_node_ids(seeded) == {1, 2, 3, 4}


def test_load_hub_candidates_pairs_each_hub_with_its_nodes(seeded):
    hubs, candidates = load_hub_candidates(seeded)
    assert [h.id for h in hubs] == [1, 2, 3, 4]
    assert [c.name for c in candidates] == ["홍대입구", "강남", "잠실", "건대입구"]
    assert [len(c.node_ids) for c in candidates] == [1, 1, 1, 1]
