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
