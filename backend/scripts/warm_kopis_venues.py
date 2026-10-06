"""앞으로 며칠 동안의 경기, 인천 공연을 훑어 공연장 좌표를 미리 캐시에 채운다.

공연 목록에는 공연장 좌표가 없어서 공연장마다 KOPIS를 두 번 더 불러야 한다. 요청 중에는 한 번에
몇 곳만 찾으므로(app.events.service.MAX_NEW_VENUE_LOOKUPS), 이 스크립트가 천천히 미리 채워 둔다.
GitHub Actions(.github/workflows/cleanup.yml의 warm-venues)가 하루 한 번 실행한다.

실행: python -m scripts.warm_kopis_venues  (DATABASE_URL과 KOPIS_API_KEY가 필요하다)
"""

import sys
import time
from dataclasses import dataclass
from datetime import date, timedelta

import httpx

from app.cache import ContentCacheRepo
from app.errors import UpstreamError
from app.events.kopis import KopisClient
from app.events.service import KOPIS_AREA_BY_REGION, MAX_CONSECUTIVE_LOOKUP_FAILURES, resolve_venues

DAYS_AHEAD = 14
# 한 번 실행에서 새로 찾는 공연장 수의 상한. 첫 실행이 너무 길어지지 않게 하고, 나머지는 다음 날 이어서 한다.
MAX_LOOKUPS_PER_RUN = 150
# KOPIS는 짧은 시간에 몰린 호출을 막는다. 호출 사이에 쉰다.
PAUSE_SECONDS = 1.0


@dataclass(frozen=True)
class WarmResult:
    looked_up: int
    failures: int
    blocked: bool  # KOPIS가 막고 있다고 보고 중간에 멈췄다


def warm(
    cache: ContentCacheRepo,
    client: KopisClient,
    today: date,
    days: int = DAYS_AHEAD,
    limit: int = MAX_LOOKUPS_PER_RUN,
    pause_seconds: float = PAUSE_SECONDS,
) -> WarmResult:
    """가까운 날짜부터 채운다. 예외를 밖으로 내보내지 않고 결과로 알린다."""
    looked_up = failures = 0
    areas = sorted(set(KOPIS_AREA_BY_REGION.values()))
    for offset in range(days):
        for area in areas:
            if looked_up + failures >= limit:
                return WarmResult(looked_up, failures, blocked=False)
            if pause_seconds:
                time.sleep(pause_seconds)
            try:
                rows = client.list_performances(today + timedelta(days=offset), area)
            except (httpx.HTTPError, UpstreamError):
                return WarmResult(looked_up, failures + 1, blocked=True)
            found = resolve_venues(
                area, rows, client, cache, limit=limit - looked_up - failures, pause_seconds=pause_seconds
            )
            looked_up += found.looked_up
            failures += found.failures
            if found.failures >= MAX_CONSECUTIVE_LOOKUP_FAILURES and found.looked_up == 0:
                return WarmResult(looked_up, failures, blocked=True)
    return WarmResult(looked_up, failures, blocked=False)


def exit_code(result: WarmResult) -> int:
    """KOPIS가 막았거나 실패가 성공보다 많을 때만 실행을 실패로 표시해 메일로 알게 한다.

    공연장 몇 곳의 실패는 흔하고(첫 운영 실행에서 98곳 중 4곳) 다음 실행이 다시 찾는다.
    찾은 만큼은 캐시에 남아 있다.
    """
    return 1 if result.blocked or result.failures > result.looked_up else 0


if __name__ == "__main__":
    from app.cache import utcnow
    from app.clock import kst_date
    from app.config import get_settings
    from app.db import SessionLocal

    with SessionLocal() as s:
        result = warm(ContentCacheRepo(s), KopisClient(get_settings().kopis_api_key), kst_date(utcnow()))
    print(f"looked up {result.looked_up} venues, {result.failures} failed, blocked={result.blocked}")
    sys.exit(exit_code(result))
