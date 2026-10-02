"""hubs.csv의 themes 열 초안을 만든다. 한 번 실행하고 눈으로 검토한 뒤에는 hubs.csv가 원본이다.

실행: python -m pipeline.themes          (themes가 비어 있는 행만 채운다)
      python -m pipeline.themes --force  (전부 다시 계산한다)
"""

import sys
from collections.abc import Sequence

from app.options import THEMES
from pipeline.config import MANUAL_DIR, OUT_DIR
from pipeline.io import read_csv_rows, write_csv

HUB_FIELDS = ("group_id", "name", "region", "tags", "themes", "vibe_summary")
# 측정값이 아니라 고른 값. 근거는 data/SOURCES.md.
THEME_TOP_N = 30
# 개수 상위권으로 판정하는 테마와 hub_candidates.csv의 열 이름
COUNT_COLUMNS = {"food": "food", "cafe": "cafe", "play": "play"}
THEME_TAGS = {
    "food": frozenset({"먹자골목", "맛집", "먹거리"}),
    "cafe": frozenset({"카페거리"}),
    "play": frozenset({"방탈출많음", "영화관"}),
    "drink": frozenset({"술집많음", "밤늦게까지", "포차"}),
}


def split_list(value: str) -> list[str]:
    return [v.strip() for v in value.split(";") if v.strip()]


def top_groups(
    hub_group_ids: Sequence[str],
    candidates: Sequence[dict[str, str]],
    column: str,
    n: int = THEME_TOP_N,
) -> set[str]:
    """거점 중에서 column 값이 큰 순서로 n곳의 group_id. 후보 파일에 없는 거점은 빠진다."""
    hub_set = set(hub_group_ids)
    counted = [(int(c[column]), c["group_id"]) for c in candidates if c["group_id"] in hub_set]
    ordered = sorted(counted, key=lambda pair: (-pair[0], int(pair[1])))
    return {group_id for _, group_id in ordered[:n]}


def assign_themes(
    hubs: Sequence[dict[str, str]],
    candidates: Sequence[dict[str, str]],
    n: int = THEME_TOP_N,
) -> list[list[str]]:
    group_ids = [h["group_id"] for h in hubs]
    top = {theme: top_groups(group_ids, candidates, column, n) for theme, column in COUNT_COLUMNS.items()}
    result = []
    for h in hubs:
        tags = set(split_list(h["tags"]))
        result.append([
            theme for theme in THEMES
            if h["group_id"] in top.get(theme, set()) or tags & THEME_TAGS[theme]
        ])
    return result


def fill_themes(
    hubs: Sequence[dict[str, str]],
    candidates: Sequence[dict[str, str]],
    force: bool = False,
) -> list[dict[str, str]]:
    drafted = assign_themes(hubs, candidates)
    rows = []
    for h, themes in zip(hubs, drafted, strict=True):
        existing = h.get("themes", "")
        value = existing if existing and not force else ";".join(themes)
        rows.append({**h, "themes": value})
    return rows


def main(argv: Sequence[str]) -> None:
    hubs = read_csv_rows(MANUAL_DIR / "hubs.csv")
    candidates = read_csv_rows(OUT_DIR / "hub_candidates.csv")
    rows = fill_themes(hubs, candidates, force="--force" in argv)
    write_csv(MANUAL_DIR / "hubs.csv", HUB_FIELDS, rows)
    for theme in THEMES:
        print(f"{theme}: {sum(1 for r in rows if theme in split_list(r['themes']))}곳")
    print(f"테마 없음: {sum(1 for r in rows if not r['themes'])}곳")


if __name__ == "__main__":
    main(sys.argv[1:])
