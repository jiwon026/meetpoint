import pytest

from pipeline.edges import (
    Edge,
    MatchError,
    StationIndex,
    apply_segment_patches,
    build_edges,
    check_km_drops,
    drop_implausible_km,
    parse_krail_segments,
    parse_manual_segments,
    parse_seoul_segments,
    patch_sources,
)
from pipeline.stations import StationRow

S = [
    StationRow(1, "시청", "시청", "2호선", "서울교통공사", 37.5657, 126.9769, "서울"),
    StationRow(2, "을지로입구", "을지로입구", "2호선", "서울교통공사", 37.5660, 126.9827, "서울"),
    StationRow(3, "을지로3가", "을지로3가", "2호선", "서울교통공사", 37.5663, 126.9917, "서울"),
    StationRow(4, "성수", "성수", "2호선", "서울교통공사", 37.5445, 127.0560, "서울"),
    StationRow(5, "용답", "용답", "2호선", "서울교통공사", 37.5617, 127.0513, "서울"),
    StationRow(6, "판교", "판교", "경강선", "한국철도공사", 37.3947, 127.1112, "경기"),
    StationRow(7, "이매", "이매", "경강선", "한국철도공사", 37.3960, 127.1282, "경기"),
    StationRow(8, "북한산우이", "북한산우이", "우이신설선", "우이신설경전철", 37.6631, 127.0124, "서울"),
    StationRow(9, "솔밭공원", "솔밭공원", "우이신설선", "우이신설경전철", 37.6560, 127.0132, "서울"),
]
CLASSES = {"2호선": "urban", "경강선": "regional", "우이신설선": "urban"}


def test_parse_seoul_splits_segments_at_zero_minutes():
    # 실제 파일 형식: 호선은 숫자만, 소요시간은 mm:ss
    rows = [
        {"호선": "2", "역명": "시청", "소요시간": "00:00", "역간거리(km)": "0"},
        {"호선": "2", "역명": "을지로입구", "소요시간": "02:00", "역간거리(km)": "0.7"},
        {"호선": "2", "역명": "을지로3가", "소요시간": "01:30", "역간거리(km)": "0.8"},
        {"호선": "2", "역명": "성수", "소요시간": "00:00", "역간거리(km)": "0"},
        {"호선": "2", "역명": "용답", "소요시간": "02:00", "역간거리(km)": "2.3"},
    ]
    segs = parse_seoul_segments(rows)
    assert list(segs) == ["2호선"]
    assert [[name for name, _, _ in seg] for seg in segs["2호선"]] == [
        ["시청", "을지로입구", "을지로3가"],
        ["성수", "용답"],
    ]
    assert segs["2호선"][0][1] == ("을지로입구", 0.7, 2.0)
    assert segs["2호선"][0][2] == ("을지로3가", 0.8, 1.5)


def test_parse_krail_uses_distance_only():
    rows = [
        {"철도운영기관명": "한국철도공사", "선명": "경강선", "역명": "판교", "역간거리": "0", "후행역간거리": "1.8"},
        {"철도운영기관명": "한국철도공사", "선명": "경강선", "역명": "이매", "역간거리": "1.8", "후행역간거리": ""},
    ]
    segs = parse_krail_segments(rows)
    assert segs["경강선"] == [[("판교", None, None), ("이매", 1.8, None)]]


def _krail(line, name, km, operator="코레일"):
    return {"철도운영기관명": operator, "선명": line, "역명": name, "역간거리(km)": km}


def test_parse_krail_starts_new_segment_when_line_label_changes():
    # 코레일 통합 파일은 1호선 계통마다 연천부터 다시 적는다. 선명이 바뀌면 새 구간이다.
    rows = [
        _krail("1호선(경인선)", "동인천", "1.9"),
        _krail("1호선(경인선)", "인천", "1.9"),
        _krail("1호선(광명선)", "연천", "8.7"),
        _krail("1호선(광명선)", "전곡", "3.3"),
    ]
    segs = parse_krail_segments(rows)
    assert [[n for n, _, _ in seg] for seg in segs["1호선"]] == [["동인천", "인천"], ["연천", "전곡"]]


def test_parse_krail_km_to_next_shifts_distance_to_following_station():
    rows = [_krail("경강", "판교", "1.5"), _krail("경강", "성남", "2.0"), _krail("경강", "이매", "")]
    segs = parse_krail_segments(rows, km_to_next=True)
    assert segs["경강선"] == [[("판교", None, None), ("성남", 1.5, None), ("이매", 2.0, None)]]


def test_parse_krail_km_to_next_keeps_segment_across_blank_distance():
    # 9호선 파일은 신논현 뒤로 역간거리가 비어 있다. 다음 역까지 방식에서는 빈 값이 구간 끝이 아니다.
    rows = [_krail("9호선", "신논현", ""), _krail("9호선", "언주", ""), _krail("9호선", "선정릉", "")]
    segs = parse_krail_segments(rows, km_to_next=True)
    assert [[n for n, _, _ in seg] for seg in segs["9호선"]] == [["신논현", "언주", "선정릉"]]


def test_parse_krail_skips_out_of_area_names_and_breaks_there():
    rows = [_krail("1호선(경부선)", n, "1") for n in ("평택", "성환", "직산", "천안")]
    segs = parse_krail_segments(rows, skip_names={"직산", "천안"})
    assert [[n for n, _, _ in seg] for seg in segs["1호선"]] == [["평택", "성환"]]


def test_apply_segment_patches_from_previous_keeps_km_on_following_station():
    # 서울 파일(직전 역부터): 용답 행 2.3km, 3분은 빠진 지선 첫 역 성수부터의 실측이라 용답에 남는다.
    segs = {
        "2호선": [[("충정로", None, None), ("시청", 1.1, 1.5), ("용답", 2.3, 3.0), ("신답", 1.0, 1.5)]],
        "3호선": [[("지축", None, None), ("구파발", 1.5, 3.0)]],
    }
    patches = {("2호선", "시청", "용답"): ("|", "성수"), ("3호선", "", "지축"): ("삼송",)}
    out, used = apply_segment_patches(segs, patches)
    assert out["2호선"] == [
        [("충정로", None, None), ("시청", 1.1, 1.5)],
        [("성수", None, None), ("용답", 2.3, 3.0), ("신답", 1.0, 1.5)],
    ]
    assert out["3호선"] == [[("삼송", None, None), ("지축", None, None), ("구파발", 1.5, 3.0)]]
    assert used == set(patches)
    assert segs["3호선"][0][0] == ("지축", None, None)  # 입력은 그대로


def test_apply_segment_patches_to_next_moves_carried_km_to_inserted_station():
    # 통합 파일(다음 역까지): 회기 행 1.4km는 회기에서 다음 역(생략된 청량리)까지라 회기-청량리 쌍의 거리다.
    # 서울역-남영 쌍에는 원본 값이 없다(직선거리 추정).
    segs = {"1호선": [[("외대앞", None, None), ("회기", 0.8, None), ("남영", 1.4, None), ("용산", 1.7, None)]]}
    out, _ = apply_segment_patches(segs, {("1호선", "회기", "남영"): ("청량리", "|", "서울역")}, km_to_next=True)
    assert out["1호선"] == [
        [("외대앞", None, None), ("회기", 0.8, None), ("청량리", 1.4, None)],
        [("서울역", None, None), ("남영", None, None), ("용산", 1.7, None)],
    ]


def test_apply_segment_patches_to_next_discards_carried_km_at_break():
    # 통합 파일: 지평 행 2.9km는 지평-신촌이라는 가짜 쌍의 거리라 버린다. 가좌-신촌은 직선거리 추정.
    segs = {"경의중앙선": [[("용문", None, None), ("지평", 3.6, None), ("신촌", 2.9, None), ("서울역", 3.1, None)]]}
    out, _ = apply_segment_patches(segs, {("경의중앙선", "지평", "신촌"): ("|", "가좌")}, km_to_next=True)
    assert out["경의중앙선"] == [
        [("용문", None, None), ("지평", 3.6, None)],
        [("가좌", None, None), ("신촌", None, None), ("서울역", 3.1, None)],
    ]


def test_drop_implausible_km_discards_distance_shorter_than_straight_line():
    # 판교-이매 직선 약 1.5km. 원본 행이 밀려 0.5km가 붙으면 버리고 직선거리 추정에 맡긴다.
    index = StationIndex(S, aliases={})
    segs = {
        "경강선": [[("판교", None, None), ("이매", 0.5, None)]],
        "2호선": [[("시청", None, None), ("을지로입구", 0.1, 2.0)]],
    }
    out, drops = drop_implausible_km(segs, index)
    assert out["경강선"] == [[("판교", None, None), ("이매", None, None)]]
    assert out["2호선"] == segs["2호선"]  # 실측 분이 있는 구간은 그대로
    assert [d[:4] for d in drops] == [("경강선", "판교", "이매", 0.5)]
    assert 1.4 < drops[0][4] < 1.6


def test_drop_implausible_km_keeps_plausible_distance():
    index = StationIndex(S, aliases={})
    segs = {"경강선": [[("판교", None, None), ("이매", 1.8, None)]]}
    assert drop_implausible_km(segs, index) == (segs, [])


def test_check_km_drops_fails_on_unexpected_pair():
    drops = [("경강선", "판교", "이매", 0.5, 1.5)]
    check_km_drops(drops, {("경강선", "판교", "이매")})
    with pytest.raises(ValueError, match="EXPECTED_KM_DROPS"):
        check_km_drops(drops, set())


def test_parse_manual_orders_by_seq():
    rows = [
        {"line": "우이신설선", "seq": "2", "name": "솔밭공원"},
        {"line": "우이신설선", "seq": "1", "name": "북한산우이"},
    ]
    segs = parse_manual_segments(rows)
    assert segs["우이신설선"] == [[("북한산우이", None, None), ("솔밭공원", None, None)]]


def test_build_edges_measured_and_estimated():
    index = StationIndex(S, aliases={})
    segs = {
        "2호선": [[("시청", None, None), ("을지로입구", 0.7, 2.0)]],
        "경강선": [[("판교", None, None), ("이매", 1.8, None)]],
        "우이신설선": [[("북한산우이", None, None), ("솔밭공원", None, None)]],
    }
    edges = build_edges(segs, index, CLASSES)
    by_pair = {(e.from_id, e.to_id): e for e in edges}
    assert by_pair[(1, 2)] == Edge(1, 2, "2호선", 0.7, 2.0, "measured")
    e_regional = by_pair[(6, 7)]
    assert e_regional.source == "estimated" and e_regional.km == 1.8 and e_regional.minutes == pytest.approx(1.9, abs=0.05)
    e_manual = by_pair[(8, 9)]
    assert e_manual.source == "estimated" and 0.8 < e_manual.km < 1.0  # 직선 0.79km x 1.15


def test_build_edges_reports_all_unmatched_names():
    index = StationIndex(S, aliases={})
    segs = {"2호선": [[("시청", None, None), ("없는역", 1.0, 2.0), ("또없는역", 1.0, 2.0)]]}
    with pytest.raises(MatchError) as exc:
        build_edges(segs, index, CLASSES)
    assert exc.value.unmatched == [("2호선", "없는역"), ("2호선", "또없는역")]


def test_station_index_resolves_alias():
    rows = S + [StationRow(10, "이수", "이수", "7호선", "서울교통공사", 37.4857, 126.9820, "서울")]
    index = StationIndex(rows, aliases={"총신대입구": "이수"})
    assert index.get("총신대입구", "7호선").id == 10


def test_patch_sources_fails_on_unused_rule():
    segs = {"2호선": [[("시청", None, None), ("을지로입구", 0.7, 2.0)]]}
    with pytest.raises(ValueError, match="쓰이지 않은"):
        patch_sources([(segs, False)], {("2호선", "시청", "용답"): ("|", "성수")})


def test_patch_sources_applies_each_source_with_its_km_direction():
    seoul = {"2호선": [[("시청", None, None), ("용답", 2.3, 3.0)]]}
    krail = {"1호선": [[("회기", None, None), ("남영", 1.4, None)]]}
    patches = {("2호선", "시청", "용답"): ("|", "성수"), ("1호선", "회기", "남영"): ("청량리", "|", "서울역")}
    out_seoul, out_krail = patch_sources([(seoul, False), (krail, True)], patches)
    assert out_seoul["2호선"][1] == [("성수", None, None), ("용답", 2.3, 3.0)]
    assert out_krail["1호선"] == [[("회기", None, None), ("청량리", 1.4, None)], [("서울역", None, None), ("남영", None, None)]]
