from pathlib import Path

import pytest

from pipeline.config import canonical_line
from pipeline.io import ColumnError, pick, read_csv_rows, write_csv


def test_read_csv_rows_handles_cp949(tmp_path: Path):
    p = tmp_path / "a.csv"
    p.write_bytes("호선,역명\n2호선,홍대입구\n".encode("cp949"))
    assert read_csv_rows(p) == [{"호선": "2호선", "역명": "홍대입구"}]


def test_read_csv_rows_handles_utf8_bom(tmp_path: Path):
    p = tmp_path / "a.csv"
    p.write_bytes("\ufeff호선,역명\n2호선,홍대입구\n".encode("utf-8"))
    assert read_csv_rows(p) == [{"호선": "2호선", "역명": "홍대입구"}]


def test_pick_uses_first_present_alias():
    row = {"역간거리(km)": "1.2"}
    assert pick(row, ("역간거리", "역간거리(km)")) == "1.2"


def test_pick_raises_with_header_listing():
    with pytest.raises(ColumnError) as exc:
        pick({"a": "1", "b": "2"}, ("역명",))
    assert "역명" in str(exc.value) and "a" in str(exc.value)


def test_pick_optional_returns_empty():
    assert pick({"a": "1"}, ("역명",), required=False) == ""


def test_write_csv_round_trip(tmp_path: Path):
    p = tmp_path / "o.csv"
    write_csv(p, ["id", "name"], [{"id": 1, "name": "홍대입구"}])
    assert read_csv_rows(p) == [{"id": "1", "name": "홍대입구"}]


def test_read_csv_rows_tolerates_trailing_empty_cells(tmp_path: Path):
    p = tmp_path / "a.csv"
    p.write_text("호선,역명\n2호선,홍대입구,\n", encoding="utf-8")
    assert read_csv_rows(p) == [{"호선": "2호선", "역명": "홍대입구"}]


def test_read_csv_rows_raises_on_ragged_row(tmp_path: Path):
    p = tmp_path / "a.csv"
    p.write_text("호선,역명\n2호선\n", encoding="utf-8")
    with pytest.raises(ColumnError, match="2행"):
        read_csv_rows(p)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("2호선", "2호선"),
        ("서울 2호선", "2호선"),
        ("수도권 9호선", "9호선"),
        ("경의중앙선", "경의중앙선"),
        ("수인분당선", "수인분당선"),
        ("분당선", "수인분당선"),
        ("GTX-A", "GTX-A"),
        ("2", "2호선"),
        ("수도권  도시철도 9호선", "9호선"),
        ("인천지하철 1호선", "인천1호선"),
        ("안산과천선", "4호선"),
        ("부산 도시철도 1호선", None),
    ],
)
def test_canonical_line(raw, expected):
    assert canonical_line(raw) == expected
