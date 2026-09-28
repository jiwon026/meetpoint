from pipeline.validate import (
    check_bbox,
    check_connectivity,
    check_edge_lengths,
    check_hubs_have_nodes,
    check_sanity,
    check_times_complete,
    report_same_name_groups,
)

STATIONS = [
    {"id": "1", "name": "홍대입구", "line": "2호선", "lat": "37.5571", "lng": "126.9245", "group_id": "1"},
    {"id": "2", "name": "강남", "line": "2호선", "lat": "37.4979", "lng": "127.0276", "group_id": "2"},
    {"id": "3", "name": "외딴역", "line": "2호선", "lat": "37.5", "lng": "127.1", "group_id": "3"},
]
GROUPS = [
    {"id": "1", "name": "홍대입구"}, {"id": "2", "name": "강남"}, {"id": "3", "name": "외딴역"},
]


def test_bbox_flags_out_of_range():
    bad = STATIONS + [{"id": "9", "name": "부산", "line": "2호선", "lat": "35.1", "lng": "129.0", "group_id": "9"}]
    problems = check_bbox(bad)
    assert len(problems) == 1 and "부산" in problems[0]
    assert check_bbox(STATIONS) == []


def test_edge_length_uses_class_limit():
    edges = [{"from_id": "1", "to_id": "2", "line": "2호선", "km": "8.5"}]
    names = {"1": "홍대입구", "2": "강남"}
    assert check_edge_lengths(edges, {"2호선": "urban"}, names) != []
    assert check_edge_lengths(edges, {"2호선": "regional"}, names) == []


def test_edge_length_skips_allowlisted_pair_only():
    # 1호선 연천-전곡 8.7km는 실제로 긴 구간이라 허용 목록에 있다. 같은 노선 다른 쌍은 여전히 실패한다.
    names = {"1": "전곡", "2": "연천", "3": "홍대입구", "4": "강남"}
    allowed = [{"from_id": "1", "to_id": "2", "line": "1호선", "km": "8.7"}]
    other = [{"from_id": "3", "to_id": "4", "line": "1호선", "km": "8.7"}]
    wrong_line = [{"from_id": "1", "to_id": "2", "line": "2호선", "km": "8.7"}]
    classes = {"1호선": "urban", "2호선": "urban"}
    assert check_edge_lengths(allowed, classes, names) == []
    assert check_edge_lengths(other, classes, names) != []
    assert check_edge_lengths(wrong_line, classes, names) != []


def test_connectivity_reports_components():
    edges = [{"from_id": "1", "to_id": "2"}]
    problems = check_connectivity([1, 2, 3], edges, [])
    assert len(problems) == 1 and "2" in problems[0]
    assert check_connectivity([1, 2, 3], edges + [{"from_id": "2", "to_id": "3"}], []) == []


def test_hubs_need_at_least_one_node():
    hubs = [{"group_id": "1", "name": "홍대입구"}, {"group_id": "7", "name": "없는거점"}]
    problems = check_hubs_have_nodes(hubs, STATIONS)
    assert len(problems) == 1 and "없는거점" in problems[0]


def test_times_complete_requires_every_pair():
    times = [{"from_station_id": "1", "to_station_id": "2", "minutes": "35"}]
    problems = check_times_complete(STATIONS, hub_nodes={2}, times=times)
    assert any("2 -> 2" in p for p in problems) and any("3 -> 2" in p for p in problems)


def test_sanity_uses_group_names_and_range():
    lookup = {(1, 2): 40, (2, 1): 40}
    cases = [("홍대입구", "강남", 30, 45)]
    assert check_sanity(GROUPS, STATIONS, lookup, cases) == []
    assert check_sanity(GROUPS, STATIONS, {(1, 2): 70}, cases) != []
    assert check_sanity(GROUPS, STATIONS, {}, cases) != []


def test_same_name_groups_reported_not_failed():
    groups = GROUPS + [{"id": "4", "name": "홍대입구"}]
    report = report_same_name_groups(groups)
    assert report == ["홍대입구: groups [1, 4]"]
