import pytest

from pipeline.groups import (
    Transfer,
    assign_groups,
    build_transfers,
    group_rows,
    parse_transfer_minutes,
)
from pipeline.stations import StationRow

S = [
    StationRow(1, "신촌", "신촌", "2호선", "서울교통공사", 37.5551, 126.9368, "서울"),
    StationRow(2, "신촌", "신촌(경의중앙선)", "경의중앙선", "한국철도공사", 37.5599, 126.9426, "서울"),
    StationRow(3, "홍대입구", "홍대입구", "2호선", "서울교통공사", 37.5571, 126.9245, "서울"),
    StationRow(4, "홍대입구", "홍대입구", "경의중앙선", "한국철도공사", 37.5578, 126.9255, "서울"),
    StationRow(5, "홍대입구", "홍대입구", "공항철도", "공항철도", 37.5575, 126.9249, "서울"),
    StationRow(6, "총신대입구", "총신대입구(이수)", "4호선", "서울교통공사", 37.4863, 126.9820, "서울"),
    StationRow(7, "이수", "이수", "7호선", "서울교통공사", 37.4857, 126.9822, "서울"),
]


def test_same_name_far_apart_are_separate_groups():
    g = assign_groups(S, aliases={}, radius_km=0.5)
    assert g[1] != g[2]


def test_same_name_close_together_share_a_group():
    g = assign_groups(S, aliases={}, radius_km=0.5)
    assert g[3] == g[4] == g[5]


def test_alias_joins_different_names():
    g = assign_groups(S, aliases={"총신대입구": "이수", "이수": "총신대입구"}, radius_km=0.5)
    assert g[6] == g[7]


def test_group_ids_are_dense_from_one():
    g = assign_groups(S, aliases={"총신대입구": "이수", "이수": "총신대입구"}, radius_km=0.5)
    assert set(g.values()) == set(range(1, max(g.values()) + 1))


def test_group_rows_name_and_centroid():
    g = assign_groups(S, aliases={}, radius_km=0.5)
    rows = {r.id: r for r in group_rows(S, g)}
    hongdae = rows[g[3]]
    assert hongdae.name == "홍대입구" and hongdae.node_count == 3
    assert abs(hongdae.lat - 37.5575) < 0.001


def test_parse_transfer_minutes_keys_by_normalized_name_and_lines():
    # 실제 파일은 호선을 숫자만으로, 소요시간을 mm:ss로 적는다.
    rows = [
        {"호선": "2", "환승역명": "홍대입구", "환승노선": "경의중앙선", "환승소요시간": "03:00"},
        {"호선": "1", "환승역명": "서울역", "환승노선": "4호선", "환승소요시간": "02:13"},
    ]
    table = parse_transfer_minutes(rows)
    assert table[("홍대입구", "2호선", "경의중앙선")] == 3.0
    assert table[("서울", "1호선", "4호선")] == pytest.approx(2.2, abs=0.05)


def test_build_transfers_uses_table_then_default():
    g = assign_groups(S, aliases={}, radius_km=0.5)
    table = {("홍대입구", "2호선", "경의중앙선"): 3.0}
    transfers = {(t.from_id, t.to_id): t for t in build_transfers(S, g, table)}
    assert transfers[(3, 4)] == Transfer(3, 4, 3.0, "measured")
    assert transfers[(3, 5)] == Transfer(3, 5, 4.0, "default")
    assert (1, 2) not in transfers
