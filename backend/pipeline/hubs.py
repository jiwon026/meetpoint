"""역 그룹마다 주변 장소 개수를 세어 거점 후보 상위 150곳을 뽑는다. 카카오 REST 키 필요.

실행: python -m pipeline.hubs   (중단해도 hub_scores_cache.json 덕에 이어서 실행된다)
"""

import json
from dataclasses import asdict, dataclass
from pathlib import Path

import httpx

from app.config import get_settings
from app.places.kakao_local import KakaoLocalClient
from app.places.service import PLAY_KEYWORDS
from pipeline.config import OUT_DIR
from pipeline.io import read_csv_rows, write_csv

PLAY_WEIGHT = 3
RADIUS_M = 600
TOP_N = 150
CANDIDATE_FIELDS = ("group_id", "name", "region", "food", "cafe", "play", "score")


@dataclass(frozen=True)
class HubScore:
    group_id: int
    name: str
    region: str
    food: int
    cafe: int
    play: int
    score: int


def score_group(client, group: dict[str, str], radius_m: int = RADIUS_M) -> HubScore:
    lat, lng = float(group["lat"]), float(group["lng"])
    food = client.count_category("FD6", lat, lng, radius=radius_m)
    cafe = client.count_category("CE7", lat, lng, radius=radius_m)
    play = sum(client.count_keyword(k, lat, lng, radius=radius_m) for k in PLAY_KEYWORDS)
    return HubScore(int(group["id"]), group["name"], group.get("region", ""), food, cafe, play, food + cafe + PLAY_WEIGHT * play)


def load_cache(path: Path) -> dict[int, dict]:
    if not path.exists():
        return {}
    return {int(k): v for k, v in json.loads(path.read_text(encoding="utf-8")).items()}


def save_cache(path: Path, cache: dict[int, dict]) -> None:
    path.write_text(json.dumps({str(k): v for k, v in cache.items()}, ensure_ascii=False, indent=0), encoding="utf-8")


def select_candidates(scores: list[HubScore], n: int = TOP_N) -> list[HubScore]:
    return sorted(scores, key=lambda s: (-s.score, s.group_id))[:n]


def _groups_with_region() -> list[dict[str, str]]:
    stations = read_csv_rows(OUT_DIR / "stations.csv")
    region_of_group: dict[str, str] = {}
    for s in sorted(stations, key=lambda r: int(r["id"])):
        region_of_group.setdefault(s["group_id"], s["region"])
    return [{**g, "region": region_of_group.get(g["id"], "")} for g in read_csv_rows(OUT_DIR / "station_groups.csv")]


def main() -> None:
    key = get_settings().kakao_rest_key.strip()
    if not key:
        raise SystemExit("KAKAO_REST_KEY가 .env에 없습니다")
    client = KakaoLocalClient(key, client=httpx.Client(timeout=10.0))
    cache_path = OUT_DIR / "hub_scores_cache.json"
    cache = load_cache(cache_path)
    groups = _groups_with_region()
    scores: list[HubScore] = []
    try:
        for g in groups:
            gid = int(g["id"])
            if gid not in cache:
                s = score_group(client, g)
                cache[gid] = {"food": s.food, "cafe": s.cafe, "play": s.play}
                if len(cache) % 20 == 0:
                    save_cache(cache_path, cache)
            c = cache[gid]
            scores.append(HubScore(gid, g["name"], g["region"], c["food"], c["cafe"], c["play"], c["food"] + c["cafe"] + PLAY_WEIGHT * c["play"]))
    finally:
        save_cache(cache_path, cache)
    top = select_candidates(scores)
    write_csv(OUT_DIR / "hub_candidates.csv", CANDIDATE_FIELDS, [asdict(s) for s in top])
    print(f"hub candidates: {len(top)} of {len(groups)} groups -> {OUT_DIR / 'hub_candidates.csv'}")


if __name__ == "__main__":
    main()
