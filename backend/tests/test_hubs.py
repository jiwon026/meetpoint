from app.hubs import hub_lines, hub_node_ids, load_hub_candidates


def test_hub_node_ids_covers_every_hub_station(seeded):
    assert hub_node_ids(seeded) == {1, 2, 3, 4}


def test_load_hub_candidates_pairs_each_hub_with_its_nodes(seeded):
    hubs, candidates = load_hub_candidates(seeded)
    assert [h.id for h in hubs] == [1, 2, 3, 4]
    assert [c.name for c in candidates] == ["홍대입구", "강남", "잠실", "건대입구"]
    assert [len(c.node_ids) for c in candidates] == [1, 1, 1, 1]


from app.models import Station, StationGroup


def test_hub_nodes_come_from_group_id_not_name(seeded):
    """같은 이름이라도 그룹이 다르면 거점 노드가 아니고, 이름이 달라도 같은 그룹이면 거점 노드다."""
    far_group = StationGroup(id=99, name="신촌", lat=37.5599, lng=126.9426)
    seeded.add(far_group)
    seeded.flush()
    # 이름은 홍대입구인데 그룹은 99: 홍대입구 거점(그룹 1)에 속하면 안 된다
    seeded.add(Station(id=90, name="홍대입구", line="가상선", lat=37.5599, lng=126.9426, group_id=99))
    # 이름은 다른데 그룹은 1: 홍대입구 거점에 속해야 한다
    seeded.add(Station(id=91, name="홍대입구경의", line="경의중앙선", lat=37.5572, lng=126.9250, group_id=1))
    seeded.commit()

    _, candidates = load_hub_candidates(seeded)
    hongdae = next(c for c in candidates if c.name == "홍대입구")
    assert set(hongdae.node_ids) == {1, 91}


def test_hub_lines_are_sorted_distinct_lines_of_the_hub_group(seeded):
    from app.stations import all_stations

    seeded.add(Station(id=7, name="강남", line="신분당선", lat=37.4979, lng=127.0276, group_id=2))
    seeded.add(Station(id=8, name="강남", line="2호선", lat=37.4979, lng=127.0276, group_id=2))
    seeded.commit()
    stations = all_stations(seeded)
    hubs, candidates = load_hub_candidates(seeded, stations)
    lines = hub_lines(hubs, stations)
    assert lines[2] == ["2호선", "신분당선"]
    assert lines[1] == ["2호선"]
    assert set(next(c for c in candidates if c.name == "강남").node_ids) == {2, 7, 8}
