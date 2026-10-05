import httpx

from app.geocoding.kakao import KAKAO_LOCAL_BASE, KAKAO_SOURCE
from app.http_json import json_object


class KakaoLocalClient:
    def __init__(self, rest_key: str, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=5.0)
        self._headers = {"Authorization": f"KakaoAK {rest_key}"}

    def _get(self, path: str, params: dict) -> list[dict]:
        response = self._client.get(f"{KAKAO_LOCAL_BASE}/{path}", params=params, headers=self._headers)
        response.raise_for_status()
        return list(json_object(response, KAKAO_SOURCE).get("documents", []))

    def category_search(
        self, code: str, lat: float, lng: float, radius: int = 600, size: int = 15
    ) -> list[dict]:
        return self._get(
            "category.json",
            {
                "category_group_code": code,
                "x": lng,
                "y": lat,
                "radius": radius,
                "size": size,
                "sort": "distance",
            },
        )

    def keyword_search(
        self, query: str, lat: float, lng: float, radius: int = 600, size: int = 15
    ) -> list[dict]:
        return self._get(
            "keyword.json",
            {"query": query, "x": lng, "y": lat, "radius": radius, "size": size, "sort": "distance"},
        )

    def suggest(self, query: str, rect: str, size: int = 5) -> list[dict]:
        """중심 좌표 없이 키워드로 찾는다. rect는 "왼쪽 경도,아래 위도,오른쪽 경도,위 위도"."""
        return self._get("keyword.json", {"query": query, "rect": rect, "size": size})

    def _total(self, path: str, params: dict) -> int:
        response = self._client.get(f"{KAKAO_LOCAL_BASE}/{path}", params=params, headers=self._headers)
        response.raise_for_status()
        return int(json_object(response, KAKAO_SOURCE).get("meta", {}).get("total_count", 0))

    def count_category(self, code: str, lat: float, lng: float, radius: int = 600) -> int:
        return self._total("category.json", {"category_group_code": code, "x": lng, "y": lat, "radius": radius, "size": 1})

    def count_keyword(self, query: str, lat: float, lng: float, radius: int = 600) -> int:
        return self._total("keyword.json", {"query": query, "x": lng, "y": lat, "radius": radius, "size": 1})
