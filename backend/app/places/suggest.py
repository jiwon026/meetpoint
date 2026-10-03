from dataclasses import dataclass

from app.geo import METRO_LAT_RANGE, METRO_LNG_RANGE
from app.places.kakao_local import KakaoLocalClient

SUGGEST_LIMIT = 5
# 수도권 밖 결과는 어차피 참여가 거절되므로 검색 단계에서 뺀다
METRO_RECT = f"{METRO_LNG_RANGE[0]},{METRO_LAT_RANGE[0]},{METRO_LNG_RANGE[1]},{METRO_LAT_RANGE[1]}"


@dataclass(frozen=True)
class PlaceSuggestion:
    name: str
    address: str


def suggest_places(client: KakaoLocalClient, query: str) -> list[PlaceSuggestion]:
    docs = client.suggest(query, METRO_RECT, size=SUGGEST_LIMIT)
    found = [
        PlaceSuggestion(
            name=d.get("place_name", ""),
            address=d.get("road_address_name") or d.get("address_name") or "",
        )
        for d in docs
    ]
    return [s for s in found if s.name and s.address]
