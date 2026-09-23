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
