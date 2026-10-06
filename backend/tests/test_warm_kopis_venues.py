from datetime import date
from pathlib import Path

import httpx
import respx

from app.cache import ContentCacheRepo
from app.events.kopis import KopisClient
from app.events.service import venue_cache_key
from scripts.warm_kopis_venues import warm

FIXTURES = Path(__file__).parent / "fixtures"
KOPIS = "http://www.kopis.or.kr/openApi/restful"
FACILITY = (FIXTURES / "kopis_facility.xml").read_text(encoding="utf-8")


def _listing(rows: list[tuple[str, str]]) -> str:
    body = "".join(f"<db><mt20id>{mt20id}</mt20id><prfnm>x</prfnm><fcltynm>{venue}</fcltynm></db>" for mt20id, venue in rows)
    return f"<dbs>{body}</dbs>"


def _mock(rows: list[tuple[str, str]]):
    listing = respx.get(f"{KOPIS}/pblprfr").mock(return_value=httpx.Response(200, text=_listing(rows)))
    detail = respx.get(url__regex=rf"{KOPIS}/pblprfr/PF\d+").mock(
        return_value=httpx.Response(200, text="<dbs><db><mt20id>x</mt20id><mt10id>FC001</mt10id></db></dbs>")
    )
    respx.get(f"{KOPIS}/prfplc/FC001").mock(return_value=httpx.Response(200, text=FACILITY))
    return listing, detail


@respx.mock
def test_warm_fills_the_venue_cache_for_both_areas_and_each_day(session):
    listing, detail = _mock([("PF001", "가 극장"), ("PF002", "나 극장")])
    cache = ContentCacheRepo(session)
    looked_up = warm(cache, KopisClient("k"), date(2026, 10, 7), days=3, pause_seconds=0)
    # 경기(41)와 인천(28) 각각 사흘치 목록을 읽고, 공연장은 지역마다 두 곳씩 한 번만 찾는다.
    assert listing.call_count == 6
    assert sorted({c.request.url.params["signgucode"] for c in listing.calls}) == ["28", "41"]
    assert sorted({c.request.url.params["stdate"] for c in listing.calls}) == ["20261007", "20261008", "20261009"]
    assert looked_up == 4
    assert detail.call_count == 4
    assert cache.get_stale(venue_cache_key("41", "가 극장")) == {"la": "37.2700", "lo": "127.0050"}
    assert cache.get_stale(venue_cache_key("28", "나 극장")) == {"la": "37.2700", "lo": "127.0050"}


@respx.mock
def test_warm_stops_at_the_limit_and_continues_next_run(session):
    _, detail = _mock([(f"PF{i:03d}", f"극장 {i}") for i in range(5)])
    cache = ContentCacheRepo(session)
    assert warm(cache, KopisClient("k"), date(2026, 10, 7), days=1, limit=3, pause_seconds=0) == 3
    assert detail.call_count == 3
    # 다음 실행은 남은 곳만 찾는다 (지역 둘 x 5곳 = 10곳 중 7곳).
    assert warm(cache, KopisClient("k"), date(2026, 10, 7), days=1, limit=100, pause_seconds=0) == 7
    assert warm(cache, KopisClient("k"), date(2026, 10, 7), days=1, limit=100, pause_seconds=0) == 0
