import pytest

from pipeline.names import normalize_station_name


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("총신대입구(이수)", "총신대입구"),
        ("신촌(경의중앙선)", "신촌"),
        ("서울역", "서울"),
        ("역곡", "역곡"),
        (" 홍대입구 ", "홍대입구"),
        ("동대문역사문화공원", "동대문역사문화공원"),
        ("4.19민주묘지", "4.19민주묘지"),
        ("경기도청북부청사", "경기도청북부청사"),
        # 표준데이터는 가운데 점(U+00B7), 국가철도공단 파일은 마침표로 적는다.
        ("시청\u00b7용인대", "시청.용인대"),
        ("시청.용인대", "시청.용인대"),
        ("전대\u2024에버랜드", "전대.에버랜드"),
        ("김포공항\u3000", "김포공항"),
    ],
)
def test_normalize_station_name(raw, expected):
    assert normalize_station_name(raw) == expected
