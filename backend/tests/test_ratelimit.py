import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.db import get_db
from app.deps import get_geocoder, get_local_client, get_matrix
from app.main import create_app
from app.places.kakao_local import KakaoLocalClient
from app.ratelimit import LIMITS, MSG_TOO_MANY_REQUESTS, Limit, SlidingWindowLimiter, client_key, reset_limiters
from app.transit.matrix import StationTimeMatrix

KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_limiter_allows_up_to_the_limit_then_blocks_until_the_window_slides():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(limit=3, window_seconds=60, clock=clock)
    assert [limiter.hit("a") for _ in range(3)] == [0, 0, 0]
    assert limiter.hit("a") == 60          # 막히면 몇 초 뒤에 다시 되는지 돌려준다
    clock.now += 59
    assert limiter.hit("a") == 1
    clock.now += 1
    assert limiter.hit("a") == 0           # 가장 오래된 요청이 창 밖으로 나갔다


def test_limiter_counts_each_key_separately_and_blocked_hits_do_not_extend_the_block():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(limit=1, window_seconds=10, clock=clock)
    assert limiter.hit("a") == 0
    assert limiter.hit("b") == 0
    for _ in range(5):
        assert limiter.hit("a") > 0
    clock.now += 10
    assert limiter.hit("a") == 0


def test_limiter_forgets_idle_keys_so_memory_stays_bounded():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(limit=5, window_seconds=10, clock=clock, max_keys=100)
    for i in range(100):
        limiter.hit(f"k{i}")
    clock.now += 11
    limiter.hit("fresh")
    assert limiter.tracked_keys() == 1


class _Req:
    def __init__(self, headers: dict[str, str], host: str | None) -> None:
        self.headers = headers
        self.client = type("C", (), {"host": host})() if host else None


def test_client_key_trusts_only_the_header_cloudflare_overwrites():
    # 운영에서는 Cloudflare가 CF-Connecting-IP를 덮어쓴다. X-Forwarded-For의 왼쪽 값은 호출자가 꾸밀 수 있어 쓰지 않는다.
    assert client_key(_Req({"cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4"}, "10.0.0.1")) == "203.0.113.7"
    assert client_key(_Req({"x-forwarded-for": "1.2.3.4"}, "10.0.0.1")) == "10.0.0.1"
    assert client_key(_Req({}, None)) == "unknown"


SMALL = 4


@pytest.fixture
def client(seeded, monkeypatch):
    # 실제 한도(분당 120회 등)로 돌리면 테스트가 느려져 창이 밀린다. 한도만 작게 바꿔 같은 동작을 본다.
    for name, spec in LIMITS.items():
        monkeypatch.setitem(LIMITS, name, Limit(limit=SMALL, window_seconds=spec.window_seconds))
    reset_limiters()
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: None
    app.dependency_overrides[get_local_client] = lambda: KakaoLocalClient("k")
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    yield TestClient(app)
    reset_limiters()


def _post_room(client, ip: str):
    return client.post("/rooms", json={"title": "t", "meet_date": "2026-09-26"}, headers={"CF-Connecting-IP": ip})


def test_room_creation_is_limited_per_ip(client):
    limit = LIMITS["create_room"].limit
    for _ in range(limit):
        assert _post_room(client, "203.0.113.7").status_code == 201
    blocked = _post_room(client, "203.0.113.7")
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == MSG_TOO_MANY_REQUESTS == "요청이 너무 많아요. 잠시 후 다시 시도해주세요."
    assert int(blocked.headers["Retry-After"]) > 0
    # 다른 IP는 영향을 받지 않는다.
    assert _post_room(client, "203.0.113.8").status_code == 201


def test_rejected_requests_still_count_so_a_flood_of_bad_input_is_limited(client):
    limit = LIMITS["create_room"].limit
    for _ in range(limit):
        client.post("/rooms", json={"title": "", "meet_date": "2026-09-26"}, headers={"CF-Connecting-IP": "203.0.113.9"})
    assert _post_room(client, "203.0.113.9").status_code == 429


@respx.mock
def test_place_search_is_limited_before_kakao_is_called(client):
    route = respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json={"documents": []}))
    limit = LIMITS["place_search"].limit
    headers = {"CF-Connecting-IP": "203.0.113.10"}
    for _ in range(limit):
        assert client.post("/places/search", json={"q": "강남역"}, headers=headers).status_code == 200
    assert client.post("/places/search", json={"q": "강남역"}, headers=headers).status_code == 429
    assert route.call_count == limit


def test_joining_and_reading_have_their_own_limits(client):
    slug = _post_room(client, "203.0.113.11").json()["slug"]
    headers = {"CF-Connecting-IP": "203.0.113.11"}
    for i in range(LIMITS["add_participant"].limit):
        client.post(f"/rooms/{slug}/participants", json={"nickname": f"n{i}", "station_id": 1}, headers=headers)
    blocked = client.post(f"/rooms/{slug}/participants", json={"nickname": "x", "station_id": 1}, headers=headers)
    assert blocked.status_code == 429
    # 읽기(방 조회, 결과 폴링)는 제한하지 않는다. 10초마다 부르는 화면이 막히면 안 된다.
    for _ in range(50):
        assert client.get(f"/rooms/{slug}", headers=headers).status_code == 200


def test_health_is_never_limited(client):
    for _ in range(300):
        assert client.get("/health", headers={"CF-Connecting-IP": "203.0.113.12"}).status_code == 200


def test_real_limits_are_generous_enough_for_shared_ips():
    # 통신사와 학교는 여러 사람이 IP 하나를 쓴다. 한도를 조일 때는 이 숫자들의 근거를 다시 본다.
    assert LIMITS["create_room"] == Limit(limit=30, window_seconds=600)
    assert LIMITS["add_participant"] == Limit(limit=60, window_seconds=600)
    assert LIMITS["place_search"] == Limit(limit=120, window_seconds=60)
    assert LIMITS["hub_content"] == Limit(limit=120, window_seconds=60)


@respx.mock
def test_hub_content_is_limited(client):
    respx.get("https://dapi.kakao.com/v2/local/search/category.json").mock(return_value=httpx.Response(200, json={"documents": []}))
    slug = _post_room(client, "203.0.113.13").json()["slug"]
    headers = {"CF-Connecting-IP": "203.0.113.13"}
    for _ in range(LIMITS["hub_content"].limit):
        assert client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "food"}, headers=headers).status_code == 200
    assert client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "food"}, headers=headers).status_code == 429


def test_limited_routes_say_which_address_source_was_used(client):
    # 운영에서 Cloudflare 헤더가 실제로 오는지 응답 헤더로 확인할 수 있게 한다.
    # 헤더가 안 오면 모든 방문자가 프록시의 주소 하나로 묶여 한도를 함께 쓰게 된다.
    with_header = _post_room(client, "203.0.113.20")
    assert with_header.headers["X-RateLimit-Source"] == "cf-connecting-ip"
    without_header = client.post("/rooms", json={"title": "t", "meet_date": "2026-09-26"})
    assert without_header.headers["X-RateLimit-Source"] == "peer"
