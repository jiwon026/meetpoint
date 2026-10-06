"""앞으로 며칠 동안의 경기, 인천 공연을 훑어 공연장 좌표를 미리 캐시에 채운다.

공연 목록에는 공연장 좌표가 없어서 공연장마다 KOPIS를 두 번 더 불러야 한다. 요청 중에는 한 번에
몇 곳만 찾으므로(app.events.service.MAX_NEW_VENUE_LOOKUPS), 이 스크립트가 천천히 미리 채워 둔다.
GitHub Actions(.github/workflows/cleanup.yml)가 하루 한 번 실행한다.

실행: python -m scripts.warm_kopis_venues  (DATABASE_URL과 KOPIS_API_KEY가 필요하다)
"""

from datetime import date, timedelta

from app.cache import ContentCacheRepo
from app.clock import kst_date
from app.events.kopis import KopisClient
from app.events.service import KOPIS_AREA_BY_REGION, resolve_venues

DAYS_AHEAD = 14
# 한 번 실행에서 새로 찾는 공연장 수의 상한. 첫 실행이 너무 길어지지 않게 하고, 나머지는 다음 날 이어서 한다.
MAX_LOOKUPS_PER_RUN = 150
# KOPIS는 짧은 시간에 몰린 호출을 막는다. 공연장 사이에 쉰다.
PAUSE_SECONDS = 1.0


def warm(
    cache: ContentCacheRepo,
    client: KopisClient,
    today: date,
    days: int = DAYS_AHEAD,
    limit: int = MAX_LOOKUPS_PER_RUN,
    pause_seconds: float = PAUSE_SECONDS,
) -> int:
    """새로 찾은 공연장 수를 돌려준다."""
    looked_up = 0
    for area in sorted(set(KOPIS_AREA_BY_REGION.values())):
        for offset in range(days):
            if looked_up >= limit:
                return looked_up
            rows = client.list_performances(today + timedelta(days=offset), area)
            _, found = resolve_venues(area, rows, client, cache, limit=limit - looked_up, pause_seconds=pause_seconds)
            looked_up += found
    return looked_up


if __name__ == "__main__":
    from app.cache import utcnow
    from app.config import get_settings
    from app.db import SessionLocal

    with SessionLocal() as s:
        count = warm(ContentCacheRepo(s), KopisClient(get_settings().kopis_api_key), kst_date(utcnow()))
    print(f"looked up {count} venues")
