from datetime import date
from pathlib import Path

import httpx
import respx

from app.cache import ContentCacheRepo
from app.events.kopis import KopisClient
from app.events.service import MAX_CONSECUTIVE_LOOKUP_FAILURES, venue_cache_key
from scripts.warm_kopis_venues import warm

FIXTURES = Path(__file__).parent / "fixtures"
KOPIS = "http://www.kopis.or.kr/openApi/restful"
FACILITY = (FIXTURES / "kopis_facility.xml").read_text(encoding="utf-8")
DETAIL_URL = rf"{KOPIS}/pblprfr/PF\d+"


def _listing(rows: list[tuple[str, str]]) -> str:
    body = "".join(f"<db><mt20id>{mt20id}</mt20id><prfnm>x</prfnm><fcltynm>{venue}</fcltynm></db>" for mt20id, venue in rows)
    return f"<dbs>{body}</dbs>"


def _mock(rows: list[tuple[str, str]]):
    listing = respx.get(f"{KOPIS}/pblprfr").mock(return_value=httpx.Response(200, text=_listing(rows)))
    detail = respx.get(url__regex=DETAIL_URL).mock(
        return_value=httpx.Response(200, text="<dbs><db><mt20id>x</mt20id><mt10id>FC001</mt10id></db></dbs>")
    )
    respx.get(f"{KOPIS}/prfplc/FC001").mock(return_value=httpx.Response(200, text=FACILITY))
    return listing, detail


@respx.mock
def test_warm_fills_the_venue_cache_for_both_areas_and_each_day(session):
    listing, detail = _mock([("PF001", "가 극장"), ("PF002", "나 극장")])
    cache = ContentCacheRepo(session)
    result = warm(cache, KopisClient("k"), date(2026, 10, 7), days=3, pause_seconds=0)
    # 경기(41)와 인천(28) 각각 사흘치 목록을 읽고, 공연장은 지역마다 두 곳씩 한 번만 찾는다.
    assert listing.call_count == 6
    assert (result.looked_up, result.failures, result.blocked) == (4, 0, False)
    assert detail.call_count == 4
    assert cache.get_stale(venue_cache_key("41", "가 극장")) == {"la": "37.2700", "lo": "127.0050"}
    assert cache.get_stale(venue_cache_key("28", "나 극장")) == {"la": "37.2700", "lo": "127.0050"}


@respx.mock
def test_warm_goes_nearest_day_first_across_areas(session):
    listing, _ = _mock([("PF001", "가 극장")])
    warm(ContentCacheRepo(session), KopisClient("k"), date(2026, 10, 7), days=2, pause_seconds=0)
    order = [(c.request.url.params["stdate"], c.request.url.params["signgucode"]) for c in listing.calls]
    assert order == [("20261007", "28"), ("20261007", "41"), ("20261008", "28"), ("20261008", "41")]


@respx.mock
def test_warm_stops_at_the_limit_and_continues_next_run(session):
    _, detail = _mock([(f"PF{i:03d}", f"극장 {i}") for i in range(5)])
    cache = ContentCacheRepo(session)
    assert warm(cache, KopisClient("k"), date(2026, 10, 7), days=1, limit=3, pause_seconds=0).looked_up == 3
    assert detail.call_count == 3
    # 다음 실행은 남은 곳만 찾는다 (지역 둘 x 5곳 = 10곳 중 7곳).
    assert warm(cache, KopisClient("k"), date(2026, 10, 7), days=1, limit=100, pause_seconds=0).looked_up == 7
    assert warm(cache, KopisClient("k"), date(2026, 10, 7), days=1, limit=100, pause_seconds=0).looked_up == 0


@respx.mock
def test_warm_stops_and_reports_when_kopis_blocks_the_list(session):
    listing = respx.get(f"{KOPIS}/pblprfr").mock(return_value=httpx.Response(400, text="Request Blocked"))
    result = warm(ContentCacheRepo(session), KopisClient("k"), date(2026, 10, 7), days=5, pause_seconds=0)
    assert (result.looked_up, result.blocked) == (0, True)
    assert listing.call_count == 1


@respx.mock
def test_warm_stops_when_lookups_keep_failing(session):
    rows = [(f"PF{i:03d}", f"극장 {i}") for i in range(6)]
    listing = respx.get(f"{KOPIS}/pblprfr").mock(return_value=httpx.Response(200, text=_listing(rows)))
    detail = respx.get(url__regex=DETAIL_URL).mock(return_value=httpx.Response(400, text="Request Blocked"))
    result = warm(ContentCacheRepo(session), KopisClient("k"), date(2026, 10, 7), days=5, pause_seconds=0)
    # 연달아 실패하면 KOPIS가 막고 있다고 보고 다음 지역과 날짜로 넘어가지 않는다.
    assert (result.looked_up, result.blocked) == (0, True)
    assert detail.call_count == MAX_CONSECUTIVE_LOOKUP_FAILURES
    assert listing.call_count == 1
