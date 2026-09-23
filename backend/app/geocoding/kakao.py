from dataclasses import dataclass
from typing import Protocol

import httpx

KAKAO_LOCAL_BASE = "https://dapi.kakao.com/v2/local/search"


@dataclass(frozen=True)
class GeoPoint:
    lat: float
    lng: float


class Geocoder(Protocol):
    def geocode(self, query: str) -> GeoPoint | None: ...


class KakaoGeocoder:
    def __init__(self, rest_key: str, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=5.0)
        self._headers = {"Authorization": f"KakaoAK {rest_key}"}

    def _first_point(self, path: str, query: str) -> GeoPoint | None:
        response = self._client.get(
            f"{KAKAO_LOCAL_BASE}/{path}", params={"query": query, "size": 1}, headers=self._headers
        )
        response.raise_for_status()
        documents = response.json().get("documents", [])
        if not documents:
            return None
        doc = documents[0]
        return GeoPoint(lat=float(doc["y"]), lng=float(doc["x"]))

    def geocode(self, query: str) -> GeoPoint | None:
        query = query.strip()
        if not query:
            return None
        point = self._first_point("address.json", query)
        if point is not None:
            return point
        return self._first_point("keyword.json", query)
