from datetime import date, datetime, timedelta
from pathlib import Path

import httpx
import pytest
import respx

from app.cache import ContentCacheRepo
from app.errors import UpstreamError
from app.events.kopis import KopisClient
from app.events.service import (
    MAX_CONSECUTIVE_LOOKUP_FAILURES,
    MAX_NEW_VENUE_LOOKUPS,
    get_kopis_events,
    resolve_venues,
    venue_cache_key,
)
from app.models import Hub, Station

FIXTURES = Path(__file__).parent / "fixtures"
KOPIS = "http://www.kopis.or.kr/openApi/restful"
FACILITY_NEAR = (FIXTURES / "kopis_facility.xml").read_text(encoding="utf-8")
FACILITY_FAR = """<?xml version="1.0" encoding="UTF-8"?>
<dbs><db><mt10id>FC002</mt10id><fcltynm>먼 공연장</fcltynm><la>37.4000</la><lo>127.2000</lo></db></dbs>"""


@pytest.fixture(autouse=True)
def no_pause_between_lookups(monkeypatch):
    monkeypatch.setattr("app.events.service.REQUEST_LOOKUP_PAUSE_SECONDS", 0)


def _suwon_hub(seeded) -> Hub:
    station = seeded.get(Station, 6)
    hub = Hub(
        id=9, station_id=6, group_id=6, name="수원", lat=station.lat, lng=station.lng, region="경기", tags=[], vibe_summary=""
    )
    seeded.add(hub)
    seeded.commit()
    return hub


def _detail(mt20id: str, mt10id: str) -> str:
    # 실제 상세 응답에는 필드가 많다. 우리가 읽는 것은 공연장 id(mt10id)뿐이다.
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f"<dbs><db><mt20id>{mt20id}</mt20id><prfnm>x</prfnm><fcltynm>x (x)</fcltynm><mt10id>{mt10id}</mt10id></db></dbs>"
    )


def _listing(rows: list[tuple[str, str]]) -> str:
    body = "".join(
        f"<db><mt20id>{mt20id}</mt20id><prfnm>공연 {mt20id}</prfnm><prfpdfrom>2026.09.26</prfpdfrom>"
        f"<prfpdto>2026.09.26</prfpdto><fcltynm>{venue}</fcltynm><poster></poster><genrenm>연극</genrenm></db>"
        for mt20id, venue in rows
    )
    return f'<?xml version="1.0" encoding="UTF-8"?><dbs>{body}</dbs>'


def _mock_kopis():
    """목록에는 공연장 id가 없다 (실제 KOPIS와 같다). 상세에서 id를, 시설에서 좌표를 얻는다."""
    listing = respx.get(f"{KOPIS}/pblprfr").mock(
        return_value=httpx.Response(200, text=(FIXTURES / "kopis_list.xml").read_text(encoding="utf-8"))
    )
    details = {
        mt20id: respx.get(f"{KOPIS}/pblprfr/{mt20id}").mock(return_value=httpx.Response(200, text=_detail(mt20id, mt10id)))
        for mt20id, mt10id in (("PF001", "FC001"), ("PF003", "FC001"), ("PF002", "FC002"))
    }
    fac1 = respx.get(f"{KOPIS}/prfplc/FC001").mock(return_value=httpx.Response(200, text=FACILITY_NEAR))
    respx.get(f"{KOPIS}/prfplc/FC002").mock(return_value=httpx.Response(200, text=FACILITY_FAR))
    return listing, details, fac1


def test_list_fixture_matches_the_real_api_shape():
    # 2026-10-06에 실제 응답으로 확인했다. 목록에는 공연장 id(mt10id)가 없다.
    assert "<mt10id>" not in (FIXTURES / "kopis_list.xml").read_text(encoding="utf-8")


@respx.mock
def test_kopis_events_filtered_by_venue_distance(seeded):
    listing, _, _ = _mock_kopis()
    hub = _suwon_hub(seeded)
    events = get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), ContentCacheRepo(seeded))
    assert [e.title for e in events] == ["수원 재즈 나이트", "수원 재즈 나이트 2회"]
    assert events[0].place == "수원 SK아트리움"
    assert events[0].start_date == "2026-09-26"
    assert events[0].category == "대중음악"
    assert 0 < events[0].distance_m < 1500
    params = listing.calls.last.request.url.params
    assert params["stdate"] == "20260926"
    assert params["eddate"] == "20260926"
    assert params["signgucode"] == "41"


@respx.mock
def test_kopis_venue_is_looked_up_once_per_name_and_cached(seeded):
    _, details, fac1 = _mock_kopis()
    hub = _suwon_hub(seeded)
    cache = ContentCacheRepo(seeded)
    get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache)
    events = get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache)
    # 같은 공연장 이름의 공연이 둘이어도 상세와 시설 조회는 한 번씩이고, 두 번째 요청은 캐시만 쓴다.
    assert details["PF001"].call_count + details["PF003"].call_count == 1
    assert details["PF002"].call_count == 1
    assert fac1.call_count == 1
    assert len(events) == 2


@respx.mock
def test_kopis_new_venue_lookups_are_capped_per_request_and_resume(seeded):
    venues = [(f"PF{i:03d}", f"공연장 {i}") for i in range(MAX_NEW_VENUE_LOOKUPS + 3)]
    respx.get(f"{KOPIS}/pblprfr").mock(return_value=httpx.Response(200, text=_listing(venues)))
    detail = respx.get(url__regex=rf"{KOPIS}/pblprfr/PF\d+").mock(
        return_value=httpx.Response(200, text=_detail("x", "FC001"))
    )
    respx.get(f"{KOPIS}/prfplc/FC001").mock(return_value=httpx.Response(200, text=FACILITY_NEAR))
    hub = _suwon_hub(seeded)
    cache = ContentCacheRepo(seeded)
    first = get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache)
    assert detail.call_count == MAX_NEW_VENUE_LOOKUPS
    assert len(first) == MAX_NEW_VENUE_LOOKUPS
    # 다음 요청이 나머지를 이어서 채운다.
    second = get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache)
    assert detail.call_count == MAX_NEW_VENUE_LOOKUPS + 3
    assert len(second) == MAX_NEW_VENUE_LOOKUPS + 3


@respx.mock
def test_kopis_venue_without_id_or_coordinates_is_skipped_and_remembered(seeded):
    respx.get(f"{KOPIS}/pblprfr").mock(
        return_value=httpx.Response(200, text=_listing([("PF001", "id 없는 곳"), ("PF002", "좌표 없는 곳")]))
    )
    no_id = respx.get(f"{KOPIS}/pblprfr/PF001").mock(return_value=httpx.Response(200, text=_detail("PF001", "")))
    no_coords = respx.get(f"{KOPIS}/pblprfr/PF002").mock(return_value=httpx.Response(200, text=_detail("PF002", "FC009")))
    respx.get(f"{KOPIS}/prfplc/FC009").mock(
        return_value=httpx.Response(200, text="<dbs><db><mt10id>FC009</mt10id><fcltynm>x</fcltynm><la></la><lo></lo></db></dbs>")
    )
    hub = _suwon_hub(seeded)
    cache = ContentCacheRepo(seeded)
    assert get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache) == []
    assert get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache) == []
    assert (no_id.call_count, no_coords.call_count) == (1, 1)


@respx.mock
def test_kopis_lookup_failure_defers_that_venue_without_caching_or_failing_the_request(seeded):
    respx.get(f"{KOPIS}/pblprfr").mock(
        return_value=httpx.Response(200, text=_listing([("PF001", "막힌 공연장"), ("PF002", "수원 SK아트리움")]))
    )
    blocked = respx.get(f"{KOPIS}/pblprfr/PF001").mock(
        side_effect=[httpx.Response(400, text="Request Blocked"), httpx.Response(200, text=_detail("PF001", "FC001"))]
    )
    respx.get(f"{KOPIS}/pblprfr/PF002").mock(return_value=httpx.Response(200, text=_detail("PF002", "FC001")))
    respx.get(f"{KOPIS}/prfplc/FC001").mock(return_value=httpx.Response(200, text=FACILITY_NEAR))
    hub = _suwon_hub(seeded)
    cache = ContentCacheRepo(seeded)
    # 한 공연장의 조회가 실패해도 뒤의 공연장은 찾고, 요청은 찾은 만큼 돌려준다.
    assert [e.place for e in get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache)] == ["수원 SK아트리움"]
    # 실패는 캐시하지 않아서 다음 요청이 다시 찾는다.
    assert len(get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache)) == 2
    assert blocked.call_count == 2


@respx.mock
def test_kopis_stops_looking_up_after_consecutive_failures(seeded):
    venues = [(f"PF{i:03d}", f"공연장 {i}") for i in range(MAX_CONSECUTIVE_LOOKUP_FAILURES + 2)]
    respx.get(f"{KOPIS}/pblprfr").mock(return_value=httpx.Response(200, text=_listing(venues)))
    detail = respx.get(url__regex=rf"{KOPIS}/pblprfr/PF\d+").mock(return_value=httpx.Response(400, text="Request Blocked"))
    hub = _suwon_hub(seeded)
    result = resolve_venues("41", KopisClient("k").list_performances(date(2026, 9, 26), "41"), KopisClient("k"), ContentCacheRepo(seeded), limit=10)
    # KOPIS가 막고 있으면 더 두드리지 않는다.
    assert detail.call_count == MAX_CONSECUTIVE_LOOKUP_FAILURES
    assert (result.looked_up, result.failures, result.coords) == (0, MAX_CONSECUTIVE_LOOKUP_FAILURES, {})
    assert get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), ContentCacheRepo(seeded)) == []


@respx.mock
def test_kopis_rows_without_a_performance_id_or_venue_name_are_ignored(seeded):
    respx.get(f"{KOPIS}/pblprfr").mock(
        return_value=httpx.Response(200, text=_listing([("", "id 없는 공연의 장소"), ("PF009", ""), ("PF002", "수원 SK아트리움")]))
    )
    stray = respx.get(url__regex=rf"{KOPIS}/pblprfr/(PF009)?$").mock(return_value=httpx.Response(500))
    respx.get(f"{KOPIS}/pblprfr/PF002").mock(return_value=httpx.Response(200, text=_detail("PF002", "FC001")))
    respx.get(f"{KOPIS}/prfplc/FC001").mock(return_value=httpx.Response(200, text=FACILITY_NEAR))
    hub = _suwon_hub(seeded)
    events = get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), ContentCacheRepo(seeded))
    assert [e.id for e in events] == ["kopis:PF002"]
    assert stray.call_count == 0


@respx.mock
def test_kopis_missing_coordinates_are_retried_after_a_day_not_a_month(seeded):
    respx.get(f"{KOPIS}/pblprfr").mock(return_value=httpx.Response(200, text=_listing([("PF001", "수원 SK아트리움")])))
    detail = respx.get(f"{KOPIS}/pblprfr/PF001").mock(
        side_effect=[httpx.Response(200, text=_detail("PF001", "")), httpx.Response(200, text=_detail("PF001", "FC001"))]
    )
    respx.get(f"{KOPIS}/prfplc/FC001").mock(return_value=httpx.Response(200, text=FACILITY_NEAR))
    hub = _suwon_hub(seeded)
    clock = {"now": datetime(2026, 9, 20, 12, 0)}
    cache = ContentCacheRepo(seeded, now=lambda: clock["now"])
    assert get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache) == []
    clock["now"] += timedelta(hours=23)
    assert get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache) == []
    assert detail.call_count == 1
    clock["now"] += timedelta(hours=2)
    # 하루가 지나면 다시 찾는다 (목록 캐시도 하루라 목록부터 다시 읽는다).
    assert len(get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache)) == 1
    assert detail.call_count == 2


def test_venue_cache_key_fits_the_column_for_long_names():
    long_name = "아주 긴 공연장 이름 " * 30
    key = venue_cache_key("41", long_name)
    assert len(key) <= 120
    assert key != venue_cache_key("28", long_name)
    assert key != venue_cache_key("41", "다른 공연장")


@respx.mock
def test_resolve_venues_reports_how_many_it_looked_up(seeded):
    _mock_kopis()
    rows = KopisClient("k").list_performances(date(2026, 9, 26), "41")
    cache = ContentCacheRepo(seeded)
    first = resolve_venues("41", rows, KopisClient("k"), cache, limit=10)
    assert (first.looked_up, first.failures) == (2, 0)
    assert first.coords["수원 SK아트리움"] == (37.27, 127.005)
    assert resolve_venues("41", rows, KopisClient("k"), cache, limit=10).looked_up == 0


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
