import pytest

from pipeline.stations import StationRow, parse_extra, parse_standard, region_from_address

ROWS = [
    {"역사명": "홍대입구", "노선명": "2호선", "운영기관명": "서울교통공사", "위도": "37.5571", "경도": "126.9245", "도로명주소": "서울특별시 마포구 양화로 지하 160"},
    {"역사명": "홍대입구", "노선명": "경의중앙선", "운영기관명": "한국철도공사", "위도": "37.5578", "경도": "126.9255", "도로명주소": "서울특별시 마포구 양화로 지하 188"},
    {"역사명": "수원", "노선명": "경부선", "운영기관명": "한국철도공사", "위도": "37.2660", "경도": "126.9999", "도로명주소": "경기도 수원시 팔달구 덕영대로 924"},
    {"역사명": "서면", "노선명": "부산 1호선", "운영기관명": "부산교통공사", "위도": "35.1579", "경도": "129.0594", "도로명주소": "부산광역시 부산진구 중앙대로 지하 730"},
    {"역사명": "천안", "노선명": "1호선", "운영기관명": "한국철도공사", "위도": "36.8100", "경도": "127.1469", "도로명주소": "충청남도 천안시 동남구 대흥로 239"},
]


def test_parse_keeps_metro_rows_and_maps_lines():
    rows = parse_standard(ROWS)
    assert [(r.name, r.line) for r in rows] == [
        ("홍대입구", "2호선"),
        ("홍대입구", "경의중앙선"),
        ("수원", "1호선"),
    ]


def test_parse_assigns_sequential_ids_and_regions():
    rows = parse_standard(ROWS)
    assert [r.id for r in rows] == [1, 2, 3]
    assert [r.region for r in rows] == ["서울", "서울", "경기"]
    assert rows[0] == StationRow(1, "홍대입구", "홍대입구", "2호선", "서울교통공사", 37.5571, 126.9245, "서울")


def test_parse_skips_near_duplicate_within_group_radius():
    # Coordinates about 100 m apart (well within 0.5 km GROUP_RADIUS_KM)
    dup = ROWS[:1] + [dict(ROWS[0], 위도="37.5562", 경도="126.9235")]
    rows = parse_standard(dup)
    assert len(rows) == 1
    assert rows[0].name == "홍대입구"


def test_parse_raises_far_duplicate_outside_group_radius():
    # Coordinates about 3 km apart (exceeds 0.5 km GROUP_RADIUS_KM)
    dup = ROWS[:1] + [dict(ROWS[0], 위도="37.5871", 경도="126.9245")]
    with pytest.raises(ValueError, match="중복 역인데 좌표가 다름"):
        parse_standard(dup)


def test_parse_normalizes_name_but_keeps_raw():
    rows = parse_standard([dict(ROWS[0], 역사명="총신대입구(이수)")])
    assert rows[0].name == "총신대입구"
    assert rows[0].raw_name == "총신대입구(이수)"


@pytest.mark.parametrize(
    ("address", "expected"),
    [("서울특별시 마포구", "서울"), ("경기도 수원시", "경기"), ("인천광역시 부평구", "인천"), ("", ""), ("충청남도 천안시", "")],
)
def test_region_from_address(address, expected):
    assert region_from_address(address) == expected


def test_parse_extra_continues_ids_and_normalizes_names():
    extra = [
        {"name": "서울역", "line": "GTX-A", "operator": "에스지레일", "lat": "37.55585", "lng": "126.972103", "region": "서울"},
        {"name": "동탄", "line": "GTX-A", "operator": "에스지레일", "lat": "37.199943", "lng": "127.095738", "region": "경기"},
    ]
    rows = parse_extra(extra, start_id=777)
    assert rows == [
        StationRow(777, "서울", "서울역", "GTX-A", "에스지레일", 37.55585, 126.972103, "서울"),
        StationRow(778, "동탄", "동탄", "GTX-A", "에스지레일", 37.199943, 127.095738, "경기"),
    ]
