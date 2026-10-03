from pipeline.themes import assign_themes, fill_themes, split_list, top_groups

HUBS = [
    {"group_id": "1", "name": "가", "region": "서울", "tags": "술집많음;교통요지", "vibe_summary": "v"},
    {"group_id": "2", "name": "나", "region": "서울", "tags": "카페거리", "vibe_summary": "v"},
    {"group_id": "3", "name": "다", "region": "경기", "tags": "쇼핑", "vibe_summary": "v"},
    {"group_id": "4", "name": "라", "region": "경기", "tags": "영화관", "vibe_summary": "v"},
]
CANDIDATES = [
    {"group_id": "1", "name": "가", "region": "서울", "food": "900", "cafe": "100", "play": "10", "score": "0"},
    {"group_id": "2", "name": "나", "region": "서울", "food": "300", "cafe": "500", "play": "40", "score": "0"},
    {"group_id": "3", "name": "다", "region": "경기", "food": "200", "cafe": "50", "play": "5", "score": "0"},
    {"group_id": "9", "name": "거점아님", "region": "서울", "food": "5000", "cafe": "5000", "play": "5000", "score": "0"},
]


def test_split_list_drops_blanks():
    assert split_list("food; cafe;;") == ["food", "cafe"]
    assert split_list("") == []


def test_top_groups_ranks_only_hubs():
    # 거점이 아닌 group 9는 개수가 가장 많아도 순위에 들지 않는다
    assert top_groups(["1", "2", "3", "4"], CANDIDATES, "food", n=2) == {"1", "2"}


def test_top_groups_breaks_ties_by_group_id():
    tied = [{**CANDIDATES[0], "food": "100"}, {**CANDIDATES[1], "food": "100"}]
    assert top_groups(["1", "2"], tied, "food", n=1) == {"1"}


def test_assign_themes_combines_counts_and_tags():
    # n=1: food 1위는 group 1, cafe 1위와 play 1위는 group 2
    assert assign_themes(HUBS, CANDIDATES, n=1) == [
        ["food", "drink"],   # 음식점 1위 + 술집많음 태그
        ["cafe", "play"],    # 카페 1위(카페거리 태그도 있음) + 놀거리 1위
        [],                  # 해당 없음
        ["play"],            # 후보 파일에 없는 거점은 태그(영화관)로만
    ]


def test_fill_themes_keeps_existing_unless_forced():
    hubs = [{**HUBS[0], "themes": "cafe"}, {**HUBS[1], "themes": ""}]
    kept = fill_themes(hubs, CANDIDATES)
    assert [r["themes"] for r in kept] == ["cafe", "food;cafe;play"]
    forced = fill_themes(hubs, CANDIDATES, force=True)
    assert [r["themes"] for r in forced] == ["food;cafe;drink;play", "food;cafe;play"]
    # 다른 열은 그대로
    assert forced[0]["tags"] == "술집많음;교통요지"
