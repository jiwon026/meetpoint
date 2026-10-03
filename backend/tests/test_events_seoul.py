import json
from datetime import date, datetime
from pathlib import Path

import httpx
import pytest
import respx
from sqlalchemy import delete

from app.cache import ContentCacheRepo
from app.errors import UpstreamError
from app.events.seoul import SeoulEventClient
from app.events.service import SEOUL_RAW_KEY, get_seoul_events
from app.models import ContentCache, Hub

FIXTURES = Path(__file__).parent / "fixtures"
SEOUL_URL_PREFIX = "http://openapi.seoul.go.kr:8088/test-key/json/culturalEventInfo/"


def _load() -> dict:
    return json.loads((FIXTURES / "seoul_events.json").read_text(encoding="utf-8"))


@respx.mock
def test_filters_by_date_and_distance(seeded):
    respx.get(url__startswith=SEOUL_URL_PREFIX).mock(return_value=httpx.Response(200, json=_load()))
    hub = seeded.get(Hub, 1)  # 홍대입구
    events = get_seoul_events(hub, date(2026, 9, 26), SeoulEventClient("test-key"), ContentCacheRepo(seeded))
    titles = [e.title for e in events]
    assert "홍대 일러스트 페어" in titles
    assert "좌표뒤바뀐 홍대 축제" in titles  # 좌표 보정 후 반경 안
    assert "잠실 야외 콘서트" not in titles  # 1.5km 밖


@respx.mock
def test_excludes_events_not_open_on_meet_date(seeded):
    respx.get(url__startswith=SEOUL_URL_PREFIX).mock(return_value=httpx.Response(200, json=_load()))
    hub = seeded.get(Hub, 1)
    events = get_seoul_events(hub, date(2026, 10, 5), SeoulEventClient("test-key"), ContentCacheRepo(seeded))
    assert [e.title for e in events] == ["좌표뒤바뀐 홍대 축제"]


@respx.mock
def test_event_fields_are_mapped(seeded):
    respx.get(url__startswith=SEOUL_URL_PREFIX).mock(return_value=httpx.Response(200, json=_load()))
    hub = seeded.get(Hub, 1)
    events = get_seoul_events(hub, date(2026, 9, 26), SeoulEventClient("test-key"), ContentCacheRepo(seeded))
    fair = next(e for e in events if e.title == "홍대 일러스트 페어")
    assert fair.place == "KT&G 상상마당"
    assert fair.start_date == "2026-09-20"
    assert fair.end_date == "2026-09-30"
    assert fair.is_free is True
    assert fair.category == "전시/미술"
    assert 0 < fair.distance_m < 1500


@respx.mock
def test_raw_feed_is_fetched_once_and_cached(seeded):
    route = respx.get(url__startswith=SEOUL_URL_PREFIX).mock(return_value=httpx.Response(200, json=_load()))
    hub = seeded.get(Hub, 1)
    cache = ContentCacheRepo(seeded)
    get_seoul_events(hub, date(2026, 9, 26), SeoulEventClient("test-key"), cache)
    get_seoul_events(seeded.get(Hub, 3), date(2026, 9, 26), SeoulEventClient("test-key"), cache)
    assert route.call_count == 1


@respx.mock
def test_stale_feed_is_served_when_refresh_fails(seeded):
    route = respx.get(url__startswith=SEOUL_URL_PREFIX).mock(return_value=httpx.Response(200, json=_load()))
    hub = seeded.get(Hub, 1)
    expired_cache = ContentCacheRepo(seeded, now=lambda: datetime(2020, 1, 1))
    get_seoul_events(hub, date(2026, 9, 26), SeoulEventClient("test-key"), expired_cache)

    route.mock(return_value=httpx.Response(500))
    events = get_seoul_events(hub, date(2026, 9, 26), SeoulEventClient("test-key"), ContentCacheRepo(seeded))

    assert "홍대 일러스트 페어" in [e.title for e in events]


@respx.mock
def test_per_hub_result_is_cached(seeded):
    route = respx.get(url__startswith=SEOUL_URL_PREFIX).mock(return_value=httpx.Response(200, json=_load()))
    hub = seeded.get(Hub, 1)
    cache = ContentCacheRepo(seeded)
    first = get_seoul_events(hub, date(2026, 9, 26), SeoulEventClient("test-key"), cache)

    seeded.execute(delete(ContentCache).where(ContentCache.cache_key == SEOUL_RAW_KEY))
    seeded.commit()
    route.mock(return_value=httpx.Response(500))
    second = get_seoul_events(hub, date(2026, 9, 26), SeoulEventClient("test-key"), cache)

    assert [e.title for e in second] == [e.title for e in first]
    assert second


@respx.mock
def test_in_band_error_code_raises(seeded):
    payload = {"culturalEventInfo": {"RESULT": {"CODE": "ERROR-500", "MESSAGE": "서버 오류"}, "row": []}}
    respx.get(url__startswith=SEOUL_URL_PREFIX).mock(return_value=httpx.Response(200, json=payload))
    with pytest.raises(UpstreamError):
        SeoulEventClient("test-key").fetch_all()


@respx.mock
def test_top_level_no_data_code_returns_empty(seeded):
    payload = {"RESULT": {"CODE": "INFO-200", "MESSAGE": "해당하는 데이터가 없습니다."}}
    respx.get(url__startswith=SEOUL_URL_PREFIX).mock(return_value=httpx.Response(200, json=payload))
    assert SeoulEventClient("test-key").fetch_all() == []


@respx.mock
def test_non_json_error_body_raises_upstream_error(seeded):
    # 인증키가 틀리면 json을 요청해도 200과 XML 오류 본문이 온다.
    body = "<RESULT><CODE>INFO-100</CODE><MESSAGE><![CDATA[인증키가 유효하지 않습니다.]]></MESSAGE></RESULT>"
    respx.get(url__startswith=SEOUL_URL_PREFIX).mock(
        return_value=httpx.Response(200, text=body, headers={"content-type": "application/xml;charset=UTF-8"})
    )
    with pytest.raises(UpstreamError):
        SeoulEventClient("test-key").fetch_all()
