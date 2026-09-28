from pathlib import Path

from pipeline.inspect import inspect_file, missing_columns


def test_inspect_csv_returns_header_and_samples(tmp_path: Path):
    p = tmp_path / "x.csv"
    p.write_text("호선,역명\n2호선,홍대입구\n2호선,신촌\n", encoding="utf-8")
    header, samples = inspect_file(p)
    assert header == ["호선", "역명"]
    assert samples[0]["역명"] == "홍대입구"


def test_missing_columns_lists_fields_without_any_alias():
    aliases = {"name": ("역명",), "km": ("역간거리", "역간거리(km)")}
    assert missing_columns(["역명", "선명"], aliases) == ["km"]
    assert missing_columns(["역명", "역간거리(km)"], aliases) == []
