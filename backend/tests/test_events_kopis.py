from datetime import date
from pathlib import Path

import httpx
import respx

from app.cache import ContentCacheRepo
from app.events.kopis import KopisClient
from app.events.service import get_kopis_events
from app.models import Hub, Station

FIXTURES = Path(__file__).parent / "fixtures"
KOPIS = "http://www.kopis.or.kr/openApi/restful"
FACILITY_FAR = """<?xml version="1.0" encoding="UTF-8"?>
<dbs><db><mt10id>FC002</mt10id><fcltynm>먼 공연장</fcltynm><la>37.4000</la><lo>127.2000</lo></db></dbs>"""


def _suwon_hub(seeded) -> Hub:
    station = seeded.get(Station, 6)
    hub = Hub(id=9, station_id=6, name="수원", lat=station.lat, lng=station.lng, region="경기", tags=[], vibe_summary="")
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
    assert [e.title for e in events] == ["수원 재즈 나이트"]
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
    get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), cache)
    assert fac1.call_count == 1


def test_kopis_returns_empty_for_seoul_hub(seeded):
    hub = seeded.get(Hub, 1)
    assert get_kopis_events(hub, date(2026, 9, 26), KopisClient("k"), ContentCacheRepo(seeded)) == []
