from pipeline.config import MANUAL_DIR
from pipeline.edges import parse_manual_segments
from pipeline.io import read_csv_rows

EXPECTED_LINES = {"우이신설선", "신림선", "김포골드라인", "의정부경전철", "서해선", "GTX-A"}


def test_line_orders_cover_six_lines_with_unique_sequences():
    rows = read_csv_rows(MANUAL_DIR / "line_orders.csv")
    segs = parse_manual_segments(rows)
    assert set(segs) == EXPECTED_LINES
    for line in EXPECTED_LINES:
        names = [n for n, _, _ in segs[line][0]]
        assert len(names) >= 9, line
        assert len(set(names)) == len(names), line
    seqs = {(r["line"], r["seq"]) for r in rows}
    assert len(seqs) == len(rows)


def test_hubs_csv_has_100_rows_with_required_fields():
    rows = read_csv_rows(MANUAL_DIR / "hubs.csv")
    assert len(rows) == 100
    assert set(rows[0]) == {"group_id", "name", "region", "tags", "vibe_summary"}
    assert len({r["group_id"] for r in rows}) == 100
    for r in rows:
        assert r["region"] in {"서울", "경기", "인천"}, r
        assert 1 <= len(r["tags"].split(";")) <= 4, r
        assert 8 <= len(r["vibe_summary"]) <= 40, r
    regions = {reg: sum(1 for r in rows if r["region"] == reg) for reg in ("서울", "경기", "인천")}
    assert regions["서울"] >= 50 and regions["경기"] >= 20 and regions["인천"] >= 6
