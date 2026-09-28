"""raw 폴더의 원본 파일 헤더와 샘플 행을 출력하고, config.COLUMNS와 맞지 않는 컬럼을 알려준다.

실행: python -m pipeline.inspect
"""

from pathlib import Path

from pipeline.config import COLUMNS, KRAIL_DISTANCE_GLOB, RAW_DIR, RAW_FILES
from pipeline.io import read_csv_rows, read_xlsx_rows


def inspect_file(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    rows = read_xlsx_rows(path) if path.suffix.lower() in (".xlsx", ".xlsm") else read_csv_rows(path)
    header = list(rows[0]) if rows else []
    return header, rows[:3]


def missing_columns(header: list[str], aliases_by_field: dict[str, tuple[str, ...]]) -> list[str]:
    return [field for field, aliases in aliases_by_field.items() if not any(a in header for a in aliases)]


def _report(path: Path, schema: str) -> None:
    header, samples = inspect_file(path)
    print(f"\n== {path.name} ({len(header)} columns)")
    print("header:", header)
    for s in samples:
        print("row:", s)
    missing = missing_columns(header, COLUMNS[schema])
    print("missing for", schema, ":", missing or "none")


def main() -> None:
    schema_by_key = {"stations_std": "std", "seoul_times": "seoul", "transfers": "transfer"}
    for key, spec in RAW_FILES.items():
        path = RAW_DIR / spec.filename
        if path.exists():
            _report(path, schema_by_key[key])
        else:
            print(f"\n== {spec.filename}: 없음. 다운로드 {spec.url}")
    for path in sorted(RAW_DIR.glob(KRAIL_DISTANCE_GLOB)):
        _report(path, "krail")


if __name__ == "__main__":
    main()
