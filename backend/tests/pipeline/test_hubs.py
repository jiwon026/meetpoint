import json
from pathlib import Path

from pipeline.hubs import HubScore, load_cache, save_cache, score_group, select_candidates


class FakeClient:
    def count_category(self, code, lat, lng, radius=600):
        return {"FD6": 120, "CE7": 40}[code]

    def count_keyword(self, query, lat, lng, radius=600):
        return 2


def test_score_group_weights_play_three_times():
    group = {"id": "1", "name": "홍대입구", "lat": "37.5571", "lng": "126.9245", "region": "서울"}
    score = score_group(FakeClient(), group, radius_m=600)
    assert score == HubScore(1, "홍대입구", "서울", 120, 40, 10, 120 + 40 + 30)


def test_cache_round_trip(tmp_path: Path):
    p = tmp_path / "c.json"
    save_cache(p, {1: {"food": 1, "cafe": 2, "play": 3}})
    assert load_cache(p) == {1: {"food": 1, "cafe": 2, "play": 3}}
    assert load_cache(tmp_path / "missing.json") == {}


def test_select_candidates_keeps_top_n_by_score():
    scores = [HubScore(i, f"g{i}", "서울", 0, 0, 0, i) for i in range(1, 11)]
    top = select_candidates(scores, n=3)
    assert [s.group_id for s in top] == [10, 9, 8]
