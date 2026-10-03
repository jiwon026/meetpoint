from datetime import date
from pathlib import Path

import httpx
import pytest
import respx

from app.cache import ContentCacheRepo
from app.errors import UpstreamError
from app.events.kopis import KopisClient
from app.events.service import get_kopis_events
from app.models import Hub, Station

FIXTURES = Path(__file__).parent / "fixtures"
KOPIS = "http://www.kopis.or.kr/openApi/restful"
FACILITY_FAR = """<?xml version="1.0" encoding="UTF-8"?>
<dbs><db><mt10id>FC002</mt10id><fcltynm>먼 공연장</fcltynm><la>37.4000</la><lo>127.2000</lo></db></dbs>"""


def _suwon_hub(seeded) -> Hub:
    station = seeded.get(Station, 6)
    hub = Hub(
        id=9, station_id=6, group_id=6, name="수원", lat=station.lat, lng=station.lng, region="경기", tags=[], vibe_summary=""
    )
    seeded.add(hub)
    seeded.commit()
    return hub


def _mock_kopis():
    listing = respx.get(f"{KOPIS}/pblprfr").mock(
        return_value=httpx.Response(200, text=(FIXTURES / "kopis_list.xml").read_text(encoding="utf-8"))
    )
    fac1 = respx.get(f"{KOPIS}/prfplc/FC001").mock(
        return_value=httpx.Response(200, text=(FIXTURES / "kopis_facility.xml").read_text(encoding="utf-8"))
    )
    respx.get(f"{KOPIS}/prfplc/FC002").mock(return_value=httpx.Response(200, text=FACILITY_FAR))
    return listing, fac1


@respx.mock
def test_kopis_events_filtered_by_venue_distance(seeded):
    listing, _ = _mock_kopis()
    hub = _suwon_hub(seeded)
    events = get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), ContentCacheRepo(seeded))
    assert [e.title for e in events] == ["수원 재즈 나이트", "수원 재즈 나이트 2회"]
    assert events[0].place == "수원 SK아트리움"
    assert events[0].start_date == "2026-09-26"
    assert events[0].category == "대중음악"
    params = listing.calls.last.request.url.params
    assert params["stdate"] == "20260926"
    assert params["eddate"] == "20260926"
    assert params["signgucode"] == "41"


@respx.mock
def test_kopis_venue_coords_are_cached_across_calls(seeded):
    _, fac1 = _mock_kopis()
    hub = _suwon_hub(seeded)
    cache = ContentCacheRepo(seeded)
    get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache)
    events = get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache)
    # 같은 공연장(FC001)을 쓰는 공연이 둘이어도 시설 조회는 한 번뿐이다.
    assert fac1.call_count == 1
    assert len(events) == 2


def test_kopis_returns_empty_for_seoul_hub(seeded):
    hub = seeded.get(Hub, 1)
    assert get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), ContentCacheRepo(seeded)) == []


KEY_ERROR = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<dbs><db><returncode>02</returncode><errmsg>SERVICE KEY IS NOT REGISTERED ERROR</errmsg></db></dbs>"""


@respx.mock
def test_kopis_in_band_error_raises_and_is_not_cached(seeded):
    listing = respx.get(f"{KOPIS}/pblprfr").mock(return_value=httpx.Response(200, text=KEY_ERROR))
    hub = _suwon_hub(seeded)
    cache = ContentCacheRepo(seeded)
    with pytest.raises(UpstreamError):
        get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache)
    with pytest.raises(UpstreamError):
        get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache)
    assert listing.call_count == 2


@respx.mock
def test_kopis_unparseable_body_raises_upstream_error(seeded):
    respx.get(f"{KOPIS}/pblprfr").mock(return_value=httpx.Response(200, text="<html>점검 중"))
    with pytest.raises(UpstreamError):
        KopisClient("k").list_performances(date(2026, 9, 26), "41")
