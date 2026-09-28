import pytest

from pipeline.edges import (
    Edge,
    MatchError,
    StationIndex,
    apply_segment_patches,
    build_edges,
    drop_implausible_km,
    parse_krail_segments,
    parse_manual_segments,
    parse_seoul_segments,
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


def test_apply_segment_patches_breaks_inserts_and_prepends():
    segs = {
        "2호선": [[("충정로", None, None), ("시청", 1.1, 1.5), ("용답", 2.3, 3.0), ("신답", 1.0, 1.5)]],
        "1호선": [[("외대앞", None, None), ("회기", 1.4, None), ("남영", 1.7, None)]],
        "3호선": [[("지축", None, None), ("구파발", 1.5, 3.0)]],
    }
    patches = {
        ("2호선", "시청", "용답"): ("|", "성수"),
        ("1호선", "회기", "남영"): ("청량리", "|", "서울역"),
        ("3호선", "", "지축"): ("삼송",),
    }
    out = apply_segment_patches(segs, patches)
    assert out["2호선"] == [
        [("충정로", None, None), ("시청", 1.1, 1.5)],
        [("성수", None, None), ("용답", 2.3, 3.0), ("신답", 1.0, 1.5)],
    ]
    assert out["1호선"] == [
        [("외대앞", None, None), ("회기", 1.4, None), ("청량리", None, None)],
        [("서울역", None, None), ("남영", 1.7, None)],
    ]
    assert out["3호선"] == [[("삼송", None, None), ("지축", None, None), ("구파발", 1.5, 3.0)]]
    assert segs["3호선"][0][0] == ("지축", None, None)  # 입력은 그대로


def test_drop_implausible_km_discards_distance_shorter_than_straight_line():
    # 판교-이매 직선 약 1.5km. 원본 행이 밀려 0.5km가 붙으면 버리고 직선거리 추정에 맡긴다.
    index = StationIndex(S, aliases={})
    segs = {
        "경강선": [[("판교", None, None), ("이매", 0.5, None)]],
        "2호선": [[("시청", None, None), ("을지로입구", 0.1, 2.0)]],
    }
    out = drop_implausible_km(segs, index)
    assert out["경강선"] == [[("판교", None, None), ("이매", None, None)]]
    assert out["2호선"] == segs["2호선"]  # 실측 분이 있는 구간은 그대로


def test_drop_implausible_km_keeps_plausible_distance():
    index = StationIndex(S, aliases={})
    segs = {"경강선": [[("판교", None, None), ("이매", 1.8, None)]]}
    assert drop_implausible_km(segs, index) == segs


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


def test_apply_segment_patches_fails_on_unused_rule():
    segs = {"2호선": [[("시청", None, None), ("을지로입구", 0.7, 2.0)]]}
    with pytest.raises(ValueError, match="쓰이지 않은"):
        apply_segment_patches(segs, {("2호선", "시청", "용답"): ("|", "성수")})
