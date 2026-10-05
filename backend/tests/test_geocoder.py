import json
from pathlib import Path

import httpx
import pytest
import respx

from app.errors import UpstreamError
from app.geocoding.kakao import GeoPoint, KakaoGeocoder

FIXTURES = Path(__file__).parent / "fixtures"
ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@respx.mock
def test_geocode_uses_address_search_first():
    route = respx.get(ADDRESS_URL).mock(return_value=httpx.Response(200, json=_load("kakao_address.json")))
    geocoder = KakaoGeocoder(rest_key="test-key")
    point = geocoder.geocode("서울 마포구 양화로 160")
    assert point == GeoPoint(lat=37.5571, lng=126.9245)
    assert route.called
    assert route.calls.last.request.headers["Authorization"] == "KakaoAK test-key"


@respx.mock
def test_geocode_falls_back_to_keyword_search():
    respx.get(ADDRESS_URL).mock(return_value=httpx.Response(200, json=_load("kakao_keyword_empty.json")))
    keyword = respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json=_load("kakao_address.json")))
    point = KakaoGeocoder(rest_key="k").geocode("홍대 놀이터")
    assert point is not None
    assert keyword.called


@respx.mock
def test_geocode_returns_none_when_nothing_found():
    respx.get(ADDRESS_URL).mock(return_value=httpx.Response(200, json=_load("kakao_keyword_empty.json")))
    respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json=_load("kakao_keyword_empty.json")))
    assert KakaoGeocoder(rest_key="k").geocode("없는주소") is None


@respx.mock
def test_geocode_raises_on_http_error():
    respx.get(ADDRESS_URL).mock(return_value=httpx.Response(500))
    with pytest.raises(httpx.HTTPStatusError):
        KakaoGeocoder(rest_key="k").geocode("아무거나")


@respx.mock
def test_geocode_raises_upstream_error_on_non_json_body():
    respx.get(ADDRESS_URL).mock(return_value=httpx.Response(200, text="<html>blocked</html>"))
    with pytest.raises(UpstreamError):
        KakaoGeocoder(rest_key="k").geocode("서울 마포구 양화로 160")


@respx.mock
def test_geocode_raises_upstream_error_when_coordinates_are_missing():
    respx.get(ADDRESS_URL).mock(return_value=httpx.Response(200, json={"documents": [{"x": "abc"}]}))
    with pytest.raises(UpstreamError):
        KakaoGeocoder(rest_key="k").geocode("서울 마포구 양화로 160")
