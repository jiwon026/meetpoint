from app.stations import all_stations, search_stations


def test_all_stations_returns_every_seeded_station(seeded):
    assert len(all_stations(seeded)) == 6


def test_search_matches_partial_name(seeded):
    names = [s.name for s in search_stations(seeded, "홍")]
    assert names == ["홍대입구"]


def test_search_empty_query_returns_nothing(seeded):
    assert search_stations(seeded, "  ") == []


def test_search_respects_limit(seeded):
    assert len(search_stations(seeded, "입구", limit=1)) == 1


from app.models import Station, StationGroup


def test_search_shows_a_transfer_station_once_with_all_its_lines(seeded):
    seeded.add(Station(id=7, name="강남", line="신분당선", lat=37.4968, lng=127.0282, group_id=2))
    seeded.commit()
    hits = search_stations(seeded, "강남")
    assert [(h.id, h.name, h.lines) for h in hits] == [(2, "강남", ["2호선", "신분당선"])]


def test_search_keeps_same_name_stations_of_different_groups_apart(seeded):
    """신촌(2호선)과 신촌(경의중앙선)은 걸어서 갈아탈 수 없는 다른 역이다."""
    seeded.add(StationGroup(id=99, name="신촌", lat=37.5599, lng=126.9426))
    seeded.flush()
    seeded.add(Station(id=90, name="신촌", line="경의중앙선", lat=37.5599, lng=126.9426, group_id=99))
    seeded.commit()
    hits = search_stations(seeded, "신촌")
    assert [(h.id, h.lines) for h in hits] == [(5, ["2호선"]), (90, ["경의중앙선"])]


def test_search_keeps_differently_named_stations_of_one_group_apart(seeded):
    """총신대입구(4호선)와 이수(7호선)처럼 한 그룹에 이름이 둘이면 이름대로 따로 보여준다."""
    seeded.add(Station(id=7, name="이수", line="7호선", lat=37.5404, lng=127.0693, group_id=4))
    seeded.commit()
    assert [(h.name, h.lines) for h in search_stations(seeded, "이수")] == [("이수", ["7호선"])]
    assert [(h.name, h.lines) for h in search_stations(seeded, "건대")] == [("건대입구", ["2호선"])]


def test_search_limit_counts_stations_not_line_nodes(seeded):
    seeded.add(Station(id=7, name="건대입구", line="7호선", lat=37.5404, lng=127.0693, group_id=4))
    seeded.commit()
    assert [h.name for h in search_stations(seeded, "입구", limit=2)] == ["건대입구", "홍대입구"]
