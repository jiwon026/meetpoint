import json
from datetime import date
from pathlib import Path

import httpx
import respx

from app.cache import ContentCacheRepo
from app.events.seoul import SeoulEventClient
from app.events.service import get_seoul_events
from app.models import Hub

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
