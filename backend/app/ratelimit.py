"""IP별 호출 제한. 방을 마구 만들거나 주소 검색으로 카카오 할당량을 태우는 일을 무디게 한다.

프로세스 메모리에만 둔다. 서버 인스턴스가 하나라는 전제이고, 재시작하면 기록이 사라진다.
정밀한 차단이 아니라 남용을 늦추는 장치다. 통신사와 학교, 회사는 여러 사람이 IP 하나를 함께 쓰므로
한도는 넉넉하게 잡는다. 읽기(방 조회, 결과 폴링)와 /health는 제한하지 않는다.
"""

import math
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import HTTPException, Request, Response

MSG_TOO_MANY_REQUESTS = "요청이 너무 많아요. 잠시 후 다시 시도해주세요."

# 운영에서는 Cloudflare가 이 헤더를 요청마다 덮어쓴다. 호출자가 값을 꾸밀 수 없다.
# X-Forwarded-For의 왼쪽 값은 호출자가 보낸 그대로라서 쓰지 않는다.
TRUSTED_IP_HEADER = "cf-connecting-ip"
MAX_TRACKED_KEYS = 20_000


@dataclass(frozen=True)
class Limit:
    limit: int
    window_seconds: int


LIMITS: dict[str, Limit] = {
    # 방 만들기: 한 사람이 10분에 서른 개를 만들 일은 없다.
    "create_room": Limit(limit=30, window_seconds=600),
    # 약속 날짜 바꾸기: 방 만들기와 같은 정도. 날짜를 하루씩 몇 번 옮겨도 한 번에 저장한다.
    "update_room": Limit(limit=30, window_seconds=600),
    # 출발지 등록: 한 브라우저에서 여러 명을 대신 넣을 수 있고 방 정원이 20명이다.
    "add_participant": Limit(limit=60, window_seconds=600),
    # 주소 검색: 글자를 칠 때마다 부른다(0.3초 디바운스). 카카오 할당량을 쓰는 익명 프록시다.
    "place_search": Limit(limit=120, window_seconds=60),
    # 주변 장소와 행사: 캐시가 없으면 카카오, 서울시, KOPIS를 부른다.
    "hub_content": Limit(limit=120, window_seconds=60),
}


class SlidingWindowLimiter:
    """키마다 최근 window_seconds 동안의 요청 시각을 들고 있다가 limit을 넘으면 막는다."""

    def __init__(
        self,
        limit: int,
        window_seconds: int,
        clock: Callable[[], float] = time.monotonic,
        max_keys: int = MAX_TRACKED_KEYS,
    ) -> None:
        self._limit = limit
        self._window = window_seconds
        self._clock = clock
        self._max_keys = max_keys
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str) -> int:
        """요청 하나를 기록한다. 허용이면 0, 막히면 다시 시도할 수 있을 때까지의 초를 돌려준다.

        막힌 요청은 기록하지 않는다. 계속 두드린다고 막힌 시간이 늘어나지 않는다.
        """
        now = self._clock()
        cutoff = now - self._window
        with self._lock:
            if key not in self._hits and len(self._hits) >= self._max_keys:
                self._forget_idle(cutoff)
            times = self._hits.setdefault(key, deque())
            while times and times[0] <= cutoff:
                times.popleft()
            if len(times) >= self._limit:
                return max(1, math.ceil(times[0] + self._window - now))
            times.append(now)
            return 0

    def tracked_keys(self) -> int:
        with self._lock:
            return len(self._hits)

    def _forget_idle(self, cutoff: float) -> None:
        idle = [key for key, times in self._hits.items() if not times or times[-1] <= cutoff]
        for key in idle:
            del self._hits[key]


_limiters: dict[str, SlidingWindowLimiter] = {}


def _limiter(name: str) -> SlidingWindowLimiter:
    limiter = _limiters.get(name)
    if limiter is None:
        spec = LIMITS[name]
        limiter = _limiters.setdefault(name, SlidingWindowLimiter(spec.limit, spec.window_seconds))
    return limiter


def reset_limiters() -> None:
    """테스트가 서로의 기록에 영향을 받지 않게 지운다."""
    _limiters.clear()


SOURCE_HEADER = "X-RateLimit-Source"
SOURCE_PEER = "peer"


def client_key(request: Request) -> str:
    trusted = request.headers.get(TRUSTED_IP_HEADER)
    if trusted:
        return trusted
    # 로컬 개발과 테스트에는 Cloudflare가 없다. 접속한 쪽의 주소를 쓴다.
    return request.client.host if request.client else "unknown"


def _key_source(request: Request) -> str:
    return TRUSTED_IP_HEADER if request.headers.get(TRUSTED_IP_HEADER) else SOURCE_PEER


def rate_limit(name: str) -> Callable[[Request, Response], None]:
    """라우트의 dependencies에 넣는다. 한도를 넘으면 429와 Retry-After를 돌려준다."""

    def dependency(request: Request, response: Response) -> None:
        # 주소를 어디서 읽었는지 응답에 남긴다. 운영에서 "peer"가 보이면 Cloudflare 헤더가 오지 않는 것이고,
        # 그때는 모든 방문자가 프록시 주소 하나로 묶인다.
        source = _key_source(request)
        response.headers[SOURCE_HEADER] = source
        retry_after = _limiter(name).hit(client_key(request))
        if retry_after:
            raise HTTPException(
                status_code=429,
                detail=MSG_TOO_MANY_REQUESTS,
                headers={"Retry-After": str(retry_after), SOURCE_HEADER: source},
            )

    return dependency
