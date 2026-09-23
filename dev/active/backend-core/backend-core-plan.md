# 우리지금만나 백엔드 코어 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방 생성부터 공평한 만남 거점 추천, 거점별 콘텐츠(맛집, 카페, 놀거리, 행사) 조회까지 되는 FastAPI 백엔드를 테스트와 함께 완성한다.

**Architecture:** FastAPI + SQLAlchemy 2.0 + Postgres(Supabase). 외부 API(카카오 로컬, 서울시 문화행사, KOPIS)는 얇은 클라이언트 클래스로 감싸고 서비스 계층에서 캐시한다. 이동시간은 사전 계산된 station_times 테이블을 메모리에 올려 조회만 한다. 모든 테스트는 SQLite 인메모리와 고정 응답 파일로 외부 의존 없이 돈다.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, pydantic-settings, httpx, pytest, respx

**Spec:** `docs/design.md`

## Global Constraints

- Python 3.12 이상. 패키지 관리는 venv + pip, 설정은 `backend/pyproject.toml` 하나로.
- 원문 주소는 절대 저장하지 않는다. 좌표는 소수점 3자리로 반올림해서 저장한다 (설계 3절).
- 외부 API 호출은 전부 클라이언트 클래스 안에서만 한다. 서비스와 라우터는 클라이언트를 주입받는다.
- 추천 점수는 참여자 중 최대 소요시간, 동점이면 합계 (설계 6절). 상위 5곳.
- 거점역 하차 후 도보 5분 고정. 도보시간은 직선거리 x 1.3 / 시속 4km. 가까운 역이 2km 넘으면 버스 15분 고정 (설계 6절, 8절).
- 콘텐츠 캐시는 24시간. 행사 캐시 키에는 날짜 포함 (설계 7절).
- 사용자에게 보이는 에러 문구는 설계 8절 문구를 그대로 쓴다.
- 문장 부호: 코드 주석과 문구에 엠대시(—)와 가운데 점(·) 금지.
- git 커밋 단계는 이 계획에 없다. git 사용을 시작하면 각 태스크 끝에 커밋을 추가한다.
- 데이터베이스 마이그레이션 도구는 쓰지 않는다. `Base.metadata.create_all`로 만든다 (MVP).
- 테스트 실행 명령은 backend 디렉터리에서 `.venv/Scripts/pytest ...` 형태로 쓴다 (Windows).

## 작업 디렉터리 구조

```
backend/
  pyproject.toml
  .env.example
  README.md
  app/
    __init__.py
    main.py              FastAPI 앱 팩토리, 라우터 등록, /health
    config.py            Settings (env 로딩)
    db.py                엔진, 세션, get_db 의존성
    models.py            SQLAlchemy 테이블 6개
    schemas.py           요청/응답 Pydantic 모델
    deps.py              get_geocoder, get_matrix, 클라이언트 의존성
    geo.py               haversine, walk_minutes, round_coord, is_in_metro
    stations.py          역 목록 조회, 역 이름 검색
    geocoding/
      __init__.py
      kakao.py           KakaoGeocoder (주소 -> 좌표)
      nearest.py         nearest_stations (좌표 -> 가까운 역 + 도보분)
    transit/
      __init__.py
      matrix.py          StationTimeMatrix (역간 시간표 메모리 조회)
      travel.py          travel_minutes (참여자 -> 거점 소요시간)
    ranking/
      __init__.py
      rank.py            rank_hubs (공평함 순위)
    cache.py             ContentCacheRepo (TTL 캐시)
    places/
      __init__.py
      kakao_local.py     KakaoLocalClient (카테고리, 키워드 검색)
      service.py         get_places (맛집, 카페, 놀거리 + 캐시)
    events/
      __init__.py
      seoul.py           SeoulEventClient
      kopis.py           KopisClient
      service.py         get_events (날짜, 거리 필터 + 캐시)
    rooms/
      __init__.py
      slug.py            generate_slug
      service.py         create_room, get_room, add_participant, compute_result
      router.py          /rooms 엔드포인트
  scripts/
    __init__.py
    init_db.py           테이블 생성
    cleanup_expired.py   만료된 방 삭제
  tests/
    conftest.py          SQLite 인메모리, 시드 데이터 (역 6개, 거점 4개, 시간표)
    fixtures/
      kakao_address.json
      kakao_keyword_empty.json
      kakao_category_food.json
      kakao_keyword_play.json
      seoul_events.json
      kopis_list.xml
      kopis_facility.xml
    test_health.py
    test_geo.py
    test_models.py
    test_nearest.py
    test_matrix.py
    test_travel.py
    test_rank.py
    test_geocoder.py
    test_stations.py
    test_cache.py
    test_places.py
    test_events_seoul.py
    test_events_kopis.py
    test_slug.py
    test_rooms_api.py
    test_content_api.py
    test_cleanup.py
```

---

### Task 1: 프로젝트 골격과 헬스 체크

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/main.py`
- Test: `backend/tests/test_health.py`

**Interfaces:**
- Produces: `create_app() -> FastAPI`, `get_settings() -> Settings` (필드: `database_url`, `kakao_rest_key`, `seoul_api_key`, `kopis_api_key`, `cors_origins`)

- [ ] **Step 1: pyproject.toml 작성**

```toml
[project]
name = "urijigeum-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.30",
  "sqlalchemy>=2.0",
  "psycopg[binary]>=3.2",
  "pydantic-settings>=2.4",
  "httpx>=0.27",
]

[project.optional-dependencies]
dev = ["pytest>=8", "respx>=0.21", "pytest-cov>=5"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
include = ["app*", "scripts*"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 2: .env.example 작성**

```
DATABASE_URL=sqlite:///./dev.db
KAKAO_REST_KEY=
SEOUL_API_KEY=
KOPIS_API_KEY=
CORS_ORIGINS=http://localhost:3000
```

- [ ] **Step 3: 가상환경 만들고 설치**

Run (backend 디렉터리에서):
```bash
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"
```
Expected: 에러 없이 설치 완료.

- [ ] **Step 4: 실패하는 테스트 작성**

`backend/tests/test_health.py`:
```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_health_returns_ok():
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}
```

- [ ] **Step 5: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_health.py -v`
Expected: FAIL, `ModuleNotFoundError: No module named 'app'` 또는 `create_app` 없음.

- [ ] **Step 6: config.py 작성**

`backend/app/__init__.py`: 빈 파일.

`backend/app/config.py`:
```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    kakao_rest_key: str = ""
    seoul_api_key: str = ""
    kopis_api_key: str = ""
    cors_origins: str = "http://localhost:3000"

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 7: main.py 작성**

`backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="우리지금만나 API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, bool]:
        return {"ok": True}

    return app


app = create_app()
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_health.py -v`
Expected: PASS

---

### Task 2: 지리 유틸리티

**Files:**
- Create: `backend/app/geo.py`
- Test: `backend/tests/test_geo.py`

**Interfaces:**
- Produces: `haversine_km(lat1, lng1, lat2, lng2) -> float`, `walk_minutes(km: float) -> int`, `round_coord(value: float) -> float`, `is_in_metro(lat, lng) -> bool`, 상수 `BUS_FALLBACK_MINUTES = 15`, `MAX_WALK_KM = 2.0`, `HUB_EXIT_WALK_MINUTES = 5`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/test_geo.py`:
```python
import pytest

from app.geo import haversine_km, is_in_metro, round_coord, walk_minutes


def test_haversine_seoul_city_hall_to_gangnam_is_about_8_7_km():
    km = haversine_km(37.5665, 126.9780, 37.4979, 127.0276)
    assert km == pytest.approx(8.7, abs=0.3)


def test_haversine_same_point_is_zero():
    assert haversine_km(37.5, 127.0, 37.5, 127.0) == 0


def test_walk_minutes_applies_detour_and_rounds_up():
    # 1km x 1.3 / 4km/h = 19.5분 -> 20분
    assert walk_minutes(1.0) == 20


def test_walk_minutes_zero_distance_is_zero():
    assert walk_minutes(0.0) == 0


def test_round_coord_keeps_three_decimals():
    assert round_coord(37.55712345) == 37.557
    assert round_coord(126.92449) == 126.924


def test_is_in_metro_true_for_seoul_and_suwon():
    assert is_in_metro(37.5665, 126.9780)
    assert is_in_metro(37.2660, 126.9999)


def test_is_in_metro_false_for_busan():
    assert not is_in_metro(35.1796, 129.0756)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_geo.py -v`
Expected: FAIL, `No module named 'app.geo'`

- [ ] **Step 3: geo.py 작성**

`backend/app/geo.py`:
```python
import math

EARTH_RADIUS_KM = 6371.0
WALK_KMH = 4.0
WALK_DETOUR = 1.3
MAX_WALK_KM = 2.0
BUS_FALLBACK_MINUTES = 15
HUB_EXIT_WALK_MINUTES = 5

# 수도권 대략 경계 (서울, 경기, 인천)
METRO_LAT_RANGE = (36.9, 38.3)
METRO_LNG_RANGE = (126.3, 127.9)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def walk_minutes(km: float) -> int:
    return math.ceil(km * WALK_DETOUR / WALK_KMH * 60)


def round_coord(value: float) -> float:
    return round(value, 3)


def is_in_metro(lat: float, lng: float) -> bool:
    lat_ok = METRO_LAT_RANGE[0] <= lat <= METRO_LAT_RANGE[1]
    lng_ok = METRO_LNG_RANGE[0] <= lng <= METRO_LNG_RANGE[1]
    return lat_ok and lng_ok
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_geo.py -v`
Expected: 7 PASS

---

### Task 3: DB 모델과 테스트 시드

**Files:**
- Create: `backend/app/models.py`
- Create: `backend/app/db.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Produces: ORM 클래스 `Station(id, name, line, lat, lng)`, `Hub(id, station_id, name, lat, lng, region, tags: list[str], vibe_summary)`, `StationTime(from_station_id, to_station_id, minutes)`, `Room(id, slug, title, meet_date, created_at, expires_at, participants)`, `Participant(id, room_id, nickname, lat, lng, nearest_stations: list[dict], created_at)`, `ContentCache(id, hub_id, kind, cache_key, payload, fetched_at)`
- Produces: `make_engine(url) -> Engine`, `engine`, `SessionLocal`, `get_db()` FastAPI 의존성
- Produces: pytest fixture `session`(빈 DB), `seeded`(역 6개, 거점 4개, 시간표가 들어간 세션), 상수 `STATIONS`, `HUBS`, `TIMES`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/test_models.py`:
```python
from sqlalchemy import select

from app.models import Hub, Station, StationTime


def test_seed_has_six_stations_and_four_hubs(seeded):
    assert len(seeded.scalars(select(Station)).all()) == 6
    assert len(seeded.scalars(select(Hub)).all()) == 4


def test_seed_station_times_are_symmetric(seeded):
    forward = seeded.get(StationTime, (1, 2))
    backward = seeded.get(StationTime, (2, 1))
    assert forward.minutes == backward.minutes == 35


def test_seed_self_time_is_zero(seeded):
    assert seeded.get(StationTime, (3, 3)).minutes == 0


def test_hub_tags_round_trip_as_list(seeded):
    hub = seeded.get(Hub, 1)
    assert hub.tags == ["밤늦게까지", "20대"]
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_models.py -v`
Expected: FAIL, `No module named 'app.models'` 또는 fixture `seeded` 없음

- [ ] **Step 3: models.py 작성**

`backend/app/models.py`:
```python
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), index=True)
    line: Mapped[str] = mapped_column(String(30))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)


class Hub(Base):
    __tablename__ = "hubs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"))
    name: Mapped[str] = mapped_column(String(50))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    region: Mapped[str] = mapped_column(String(10))  # 서울, 경기, 인천
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    vibe_summary: Mapped[str] = mapped_column(String(120), default="")


class StationTime(Base):
    __tablename__ = "station_times"

    from_station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), primary_key=True)
    to_station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), primary_key=True)
    minutes: Mapped[int] = mapped_column(Integer)


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(40))
    meet_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)

    participants: Mapped[list["Participant"]] = relationship(
        back_populates="room", cascade="all, delete-orphan", order_by="Participant.id"
    )


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), index=True)
    nickname: Mapped[str] = mapped_column(String(20))
    lat: Mapped[float] = mapped_column(Float)  # 소수점 3자리로 반올림된 값만 저장
    lng: Mapped[float] = mapped_column(Float)
    nearest_stations: Mapped[list[dict]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime)

    room: Mapped[Room] = relationship(back_populates="participants")


class ContentCache(Base):
    __tablename__ = "content_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hub_id: Mapped[int | None] = mapped_column(ForeignKey("hubs.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(20))
    cache_key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    payload: Mapped[object] = mapped_column(JSON)
    fetched_at: Mapped[datetime] = mapped_column(DateTime)
```

- [ ] **Step 4: db.py 작성**

`backend/app/db.py`:
```python
from collections.abc import Iterator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


def make_engine(url: str) -> Engine:
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args, pool_pre_ping=True)


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
```

- [ ] **Step 5: conftest.py 작성**

`backend/tests/conftest.py`:
```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.models import Base, Hub, Station, StationTime

# id, 이름, 노선, 위도, 경도
STATIONS = [
    (1, "홍대입구", "2호선", 37.5571, 126.9245),
    (2, "강남", "2호선", 37.4979, 127.0276),
    (3, "잠실", "2호선", 37.5133, 127.1001),
    (4, "건대입구", "2호선", 37.5404, 127.0693),
    (5, "신촌", "2호선", 37.5551, 126.9368),
    (6, "수원", "1호선", 37.2660, 126.9999),
]
STATION_BY_ID = {s[0]: s for s in STATIONS}

# id, station_id, 이름, 지역, 태그, 분위기 한 줄
HUBS = [
    (1, 1, "홍대입구", "서울", ["밤늦게까지", "20대"], "밤늦게까지 북적이는 젊은 동네"),
    (2, 2, "강남", "서울", ["교통요지", "회식"], "어디서든 오기 쉬운 교통 중심"),
    (3, 3, "잠실", "서울", ["롯데월드", "가족"], "놀이공원과 대형몰이 있는 동네"),
    (4, 4, "건대입구", "서울", ["먹자골목", "대학가"], "먹자골목이 큰 대학가"),
]

# (from, to): 분. 양방향으로 적재된다.
TIMES = {
    (1, 2): 35, (1, 3): 45, (1, 4): 30, (1, 5): 3,
    (2, 3): 15, (2, 4): 20, (2, 5): 33,
    (3, 4): 12, (3, 5): 43,
    (4, 5): 28,
    (6, 1): 80, (6, 2): 60, (6, 3): 70, (6, 4): 75, (6, 5): 78,
}


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def session(engine):
    with Session(engine, expire_on_commit=False) as s:
        yield s


@pytest.fixture
def seeded(session):
    session.add_all(
        [Station(id=i, name=n, line=l, lat=la, lng=lo) for i, n, l, la, lo in STATIONS]
    )
    session.add_all(
        [
            Hub(
                id=i,
                station_id=sid,
                name=n,
                lat=STATION_BY_ID[sid][3],
                lng=STATION_BY_ID[sid][4],
                region=r,
                tags=t,
                vibe_summary=v,
            )
            for i, sid, n, r, t, v in HUBS
        ]
    )
    rows = []
    for (a, b), m in TIMES.items():
        rows.append(StationTime(from_station_id=a, to_station_id=b, minutes=m))
        rows.append(StationTime(from_station_id=b, to_station_id=a, minutes=m))
    for i, *_ in STATIONS:
        rows.append(StationTime(from_station_id=i, to_station_id=i, minutes=0))
    session.add_all(rows)
    session.commit()
    return session
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_models.py -v`
Expected: 4 PASS

---

### Task 4: 가까운 역 찾기

**Files:**
- Create: `backend/app/geocoding/__init__.py`
- Create: `backend/app/geocoding/nearest.py`
- Test: `backend/tests/test_nearest.py`

**Interfaces:**
- Consumes: `Station` (Task 3), `haversine_km`, `walk_minutes`, `MAX_WALK_KM`, `BUS_FALLBACK_MINUTES` (Task 2)
- Produces: `StationWalk(station_id: int, station_name: str, walk_minutes: int, via: str)` frozen dataclass (`via`는 `"walk"` 또는 `"bus"`), `nearest_stations(lat, lng, stations: Sequence[Station], k: int = 3) -> list[StationWalk]`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/test_nearest.py`:
```python
import pytest
from sqlalchemy import select

from app.geocoding.nearest import StationWalk, nearest_stations
from app.models import Station


def _stations(seeded):
    return seeded.scalars(select(Station)).all()


def test_returns_up_to_three_nearest_sorted_by_distance(seeded):
    # 홍대입구와 신촌 사이 지점
    result = nearest_stations(37.5560, 126.9300, _stations(seeded))
    names = {r.station_name for r in result[:2]}
    assert names == {"홍대입구", "신촌"}
    assert len(result) <= 3
    assert all(r.via == "walk" for r in result)


def test_walk_minutes_are_positive_and_increasing(seeded):
    result = nearest_stations(37.5560, 126.9300, _stations(seeded))
    minutes = [r.walk_minutes for r in result]
    assert minutes == sorted(minutes)
    assert minutes[0] > 0


def test_far_from_any_station_falls_back_to_bus(seeded):
    # 과천 근처, 시드 역들에서 2km 넘게 떨어진 지점
    result = nearest_stations(37.4300, 126.9900, _stations(seeded))
    assert len(result) == 1
    assert result[0].via == "bus"
    assert result[0].walk_minutes == 15
    assert result[0].station_name == "강남"


def test_station_walk_is_immutable():
    sw = StationWalk(station_id=1, station_name="홍대입구", walk_minutes=5, via="walk")
    with pytest.raises(AttributeError):
        sw.walk_minutes = 10  # type: ignore[misc]
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_nearest.py -v`
Expected: FAIL, `No module named 'app.geocoding'`

- [ ] **Step 3: nearest.py 작성**

`backend/app/geocoding/__init__.py`: 빈 파일.

`backend/app/geocoding/nearest.py`:
```python
from collections.abc import Sequence
from dataclasses import dataclass

from app.geo import BUS_FALLBACK_MINUTES, MAX_WALK_KM, haversine_km, walk_minutes
from app.models import Station


@dataclass(frozen=True)
class StationWalk:
    station_id: int
    station_name: str
    walk_minutes: int
    via: str  # "walk" 또는 "bus"


def nearest_stations(
    lat: float, lng: float, stations: Sequence[Station], k: int = 3
) -> list[StationWalk]:
    if not stations:
        return []
    by_distance = sorted(
        ((haversine_km(lat, lng, s.lat, s.lng), s) for s in stations),
        key=lambda pair: pair[0],
    )
    within = [(km, s) for km, s in by_distance if km <= MAX_WALK_KM][:k]
    if within:
        return [
            StationWalk(s.id, s.name, walk_minutes(km), "walk") for km, s in within
        ]
    _, closest = by_distance[0]
    return [StationWalk(closest.id, closest.name, BUS_FALLBACK_MINUTES, "bus")]
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_nearest.py -v`
Expected: 4 PASS

---

### Task 5: 역간 시간표 조회와 참여자 소요시간

**Files:**
- Create: `backend/app/transit/__init__.py`
- Create: `backend/app/transit/matrix.py`
- Create: `backend/app/transit/travel.py`
- Test: `backend/tests/test_matrix.py`
- Test: `backend/tests/test_travel.py`

**Interfaces:**
- Consumes: `StationTime` (Task 3), `StationWalk` (Task 4), `HUB_EXIT_WALK_MINUTES` (Task 2)
- Produces: `StationTimeMatrix(times: dict[tuple[int, int], int])`, `StationTimeMatrix.load(session, to_station_ids: Iterable[int]) -> StationTimeMatrix`, `StationTimeMatrix.minutes(from_id, to_id) -> int | None`
- Produces: `Leg(origin_station_id, origin_station_name, access_minutes, transit_minutes, total_minutes, via)` frozen dataclass, `travel_minutes(nearest: Sequence[StationWalk], hub_node_ids: Sequence[int], matrix) -> Leg | None`

- [ ] **Step 1: 실패하는 테스트 작성 (matrix)**

`backend/tests/test_matrix.py`:
```python
from app.transit.matrix import StationTimeMatrix


def test_minutes_returns_seeded_value(seeded):
    matrix = StationTimeMatrix.load(seeded, to_station_ids={2})
    assert matrix.minutes(1, 2) == 35
    assert matrix.minutes(6, 2) == 60


def test_same_station_is_zero_even_if_not_loaded():
    matrix = StationTimeMatrix({})
    assert matrix.minutes(7, 7) == 0


def test_unknown_pair_returns_none(seeded):
    matrix = StationTimeMatrix.load(seeded, to_station_ids={2})
    assert matrix.minutes(1, 3) is None


def test_load_only_keeps_requested_destinations(seeded):
    matrix = StationTimeMatrix.load(seeded, to_station_ids={2, 3})
    assert matrix.minutes(1, 3) == 45
    assert matrix.minutes(1, 4) is None
```

- [ ] **Step 2: 실패하는 테스트 작성 (travel)**

`backend/tests/test_travel.py`:
```python
from app.geocoding.nearest import StationWalk
from app.transit.matrix import StationTimeMatrix
from app.transit.travel import Leg, travel_minutes

MATRIX = StationTimeMatrix({(1, 2): 35, (5, 2): 33, (1, 3): 45})


def test_picks_cheapest_origin_station():
    nearest = [
        StationWalk(1, "홍대입구", 5, "walk"),
        StationWalk(5, "신촌", 12, "walk"),
    ]
    leg = travel_minutes(nearest, hub_node_ids=[2], matrix=MATRIX)
    assert leg == Leg(
        origin_station_id=1,
        origin_station_name="홍대입구",
        access_minutes=5,
        transit_minutes=35,
        total_minutes=45,
        via="walk",
    )


def test_returns_none_when_no_route():
    nearest = [StationWalk(1, "홍대입구", 5, "walk")]
    assert travel_minutes(nearest, hub_node_ids=[9], matrix=MATRIX) is None


def test_bus_fallback_is_carried_through():
    nearest = [StationWalk(1, "홍대입구", 15, "bus")]
    leg = travel_minutes(nearest, hub_node_ids=[3], matrix=MATRIX)
    assert leg is not None
    assert leg.via == "bus"
    assert leg.total_minutes == 15 + 45 + 5


def test_takes_min_over_multiple_hub_nodes():
    matrix = StationTimeMatrix({(1, 2): 35, (1, 8): 20})
    nearest = [StationWalk(1, "홍대입구", 5, "walk")]
    leg = travel_minutes(nearest, hub_node_ids=[2, 8], matrix=matrix)
    assert leg is not None
    assert leg.transit_minutes == 20
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_matrix.py tests/test_travel.py -v`
Expected: FAIL, `No module named 'app.transit'`

- [ ] **Step 4: matrix.py 작성**

`backend/app/transit/__init__.py`: 빈 파일.

`backend/app/transit/matrix.py`:
```python
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import StationTime


class StationTimeMatrix:
    """역간 최단 소요시간(분)을 메모리에 들고 조회만 한다. 만든 뒤에는 바꾸지 않는다."""

    def __init__(self, times: dict[tuple[int, int], int]) -> None:
        self._times = dict(times)

    @classmethod
    def load(cls, session: Session, to_station_ids: Iterable[int]) -> "StationTimeMatrix":
        ids = list(set(to_station_ids))
        stmt = select(StationTime).where(StationTime.to_station_id.in_(ids))
        rows = session.scalars(stmt).all()
        return cls({(r.from_station_id, r.to_station_id): r.minutes for r in rows})

    def minutes(self, from_id: int, to_id: int) -> int | None:
        if from_id == to_id:
            return 0
        return self._times.get((from_id, to_id))

    def __len__(self) -> int:
        return len(self._times)
```

- [ ] **Step 5: travel.py 작성**

`backend/app/transit/travel.py`:
```python
from collections.abc import Sequence
from dataclasses import dataclass

from app.geo import HUB_EXIT_WALK_MINUTES
from app.geocoding.nearest import StationWalk
from app.transit.matrix import StationTimeMatrix


@dataclass(frozen=True)
class Leg:
    origin_station_id: int
    origin_station_name: str
    access_minutes: int
    transit_minutes: int
    total_minutes: int
    via: str


def travel_minutes(
    nearest: Sequence[StationWalk],
    hub_node_ids: Sequence[int],
    matrix: StationTimeMatrix,
) -> Leg | None:
    best: Leg | None = None
    for origin in nearest:
        for node_id in hub_node_ids:
            transit = matrix.minutes(origin.station_id, node_id)
            if transit is None:
                continue
            total = origin.walk_minutes + transit + HUB_EXIT_WALK_MINUTES
            if best is None or total < best.total_minutes:
                best = Leg(
                    origin_station_id=origin.station_id,
                    origin_station_name=origin.station_name,
                    access_minutes=origin.walk_minutes,
                    transit_minutes=transit,
                    total_minutes=total,
                    via=origin.via,
                )
    return best
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_matrix.py tests/test_travel.py -v`
Expected: 8 PASS

---

### Task 6: 공평함 순위

**Files:**
- Create: `backend/app/ranking/__init__.py`
- Create: `backend/app/ranking/rank.py`
- Test: `backend/tests/test_rank.py`

**Interfaces:**
- Consumes: `StationWalk` (Task 4), `StationTimeMatrix`, `Leg`, `travel_minutes` (Task 5)
- Produces: `ParticipantInput(id, nickname, nearest: tuple[StationWalk, ...])`, `HubCandidate(hub_id, name, node_ids: tuple[int, ...])`, `ParticipantLeg(participant_id, nickname, leg: Leg)`, `HubScore(hub_id, name, max_minutes, sum_minutes, spread_minutes, legs: tuple[ParticipantLeg, ...])`, `rank_hubs(participants, hubs, matrix, top_n=5) -> list[HubScore]`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/test_rank.py`:
```python
from sqlalchemy import select

from app.geocoding.nearest import StationWalk
from app.models import Hub, Station
from app.ranking.rank import HubCandidate, ParticipantInput, rank_hubs
from app.transit.matrix import StationTimeMatrix


def _candidates(seeded):
    stations = seeded.scalars(select(Station)).all()
    hubs = seeded.scalars(select(Hub)).all()
    return [
        HubCandidate(h.id, h.name, tuple(s.id for s in stations if s.name == h.name))
        for h in hubs
    ]


def _participants():
    return [
        ParticipantInput(1, "홍대사는친구", (StationWalk(1, "홍대입구", 5, "walk"),)),
        ParticipantInput(2, "수원사는친구", (StationWalk(6, "수원", 5, "walk"),)),
        ParticipantInput(3, "잠실사는친구", (StationWalk(3, "잠실", 5, "walk"),)),
    ]


def test_fairness_prefers_gangnam_over_jamsil(seeded):
    """잠실은 두 명에게 가깝지만 수원 친구가 80분. 강남이 최대 70분으로 가장 공평하다."""
    matrix = StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    scores = rank_hubs(_participants(), _candidates(seeded), matrix)
    assert [s.name for s in scores] == ["강남", "잠실", "건대입구", "홍대입구"]
    top = scores[0]
    assert top.max_minutes == 70
    assert top.spread_minutes == 70 - 25
    assert {l.nickname: l.leg.total_minutes for l in top.legs} == {
        "홍대사는친구": 45,
        "수원사는친구": 70,
        "잠실사는친구": 25,
    }


def test_top_n_limits_results(seeded):
    matrix = StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    scores = rank_hubs(_participants(), _candidates(seeded), matrix, top_n=2)
    assert len(scores) == 2


def test_tie_on_max_breaks_by_sum():
    matrix = StationTimeMatrix({(1, 10): 30, (2, 10): 30, (1, 11): 30, (2, 11): 10})
    participants = [
        ParticipantInput(1, "a", (StationWalk(1, "A", 0, "walk"),)),
        ParticipantInput(2, "b", (StationWalk(2, "B", 0, "walk"),)),
    ]
    hubs = [HubCandidate(10, "같은최대_합큼", (10,)), HubCandidate(11, "같은최대_합작음", (11,))]
    scores = rank_hubs(participants, hubs, matrix)
    assert [s.hub_id for s in scores] == [11, 10]


def test_hub_unreachable_by_anyone_is_dropped():
    matrix = StationTimeMatrix({(1, 10): 30})
    participants = [
        ParticipantInput(1, "a", (StationWalk(1, "A", 0, "walk"),)),
        ParticipantInput(2, "b", (StationWalk(2, "B", 0, "walk"),)),
    ]
    hubs = [HubCandidate(10, "b는못감", (10,))]
    assert rank_hubs(participants, hubs, matrix) == []
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_rank.py -v`
Expected: FAIL, `No module named 'app.ranking'`

- [ ] **Step 3: rank.py 작성**

`backend/app/ranking/__init__.py`: 빈 파일.

`backend/app/ranking/rank.py`:
```python
from collections.abc import Sequence
from dataclasses import dataclass

from app.geocoding.nearest import StationWalk
from app.transit.matrix import StationTimeMatrix
from app.transit.travel import Leg, travel_minutes


@dataclass(frozen=True)
class ParticipantInput:
    id: int
    nickname: str
    nearest: tuple[StationWalk, ...]


@dataclass(frozen=True)
class HubCandidate:
    hub_id: int
    name: str
    node_ids: tuple[int, ...]


@dataclass(frozen=True)
class ParticipantLeg:
    participant_id: int
    nickname: str
    leg: Leg


@dataclass(frozen=True)
class HubScore:
    hub_id: int
    name: str
    max_minutes: int
    sum_minutes: int
    spread_minutes: int
    legs: tuple[ParticipantLeg, ...]


def _score_hub(
    participants: Sequence[ParticipantInput],
    hub: HubCandidate,
    matrix: StationTimeMatrix,
) -> HubScore | None:
    legs: list[ParticipantLeg] = []
    for p in participants:
        leg = travel_minutes(p.nearest, hub.node_ids, matrix)
        if leg is None:
            return None
        legs.append(ParticipantLeg(p.id, p.nickname, leg))
    totals = [l.leg.total_minutes for l in legs]
    return HubScore(
        hub_id=hub.hub_id,
        name=hub.name,
        max_minutes=max(totals),
        sum_minutes=sum(totals),
        spread_minutes=max(totals) - min(totals),
        legs=tuple(legs),
    )


def rank_hubs(
    participants: Sequence[ParticipantInput],
    hubs: Sequence[HubCandidate],
    matrix: StationTimeMatrix,
    top_n: int = 5,
) -> list[HubScore]:
    scored = [s for h in hubs if (s := _score_hub(participants, h, matrix)) is not None]
    ordered = sorted(scored, key=lambda s: (s.max_minutes, s.sum_minutes, s.hub_id))
    return ordered[:top_n]
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_rank.py -v`
Expected: 4 PASS

---

### Task 7: 카카오 지오코더와 역 검색

**Files:**
- Create: `backend/app/geocoding/kakao.py`
- Create: `backend/app/stations.py`
- Create: `backend/tests/fixtures/kakao_address.json`
- Create: `backend/tests/fixtures/kakao_keyword_empty.json`
- Test: `backend/tests/test_geocoder.py`
- Test: `backend/tests/test_stations.py`

**Interfaces:**
- Produces: `GeoPoint(lat, lng)` frozen dataclass, `Geocoder` Protocol (`geocode(query: str) -> GeoPoint | None`), `KakaoGeocoder(rest_key: str, client: httpx.Client | None = None)`, 상수 `KAKAO_LOCAL_BASE`
- Produces: `all_stations(session) -> list[Station]`, `search_stations(session, q: str, limit: int = 10) -> list[Station]`

- [ ] **Step 1: 고정 응답 파일 작성**

`backend/tests/fixtures/kakao_address.json`:
```json
{
  "meta": {"total_count": 1, "pageable_count": 1, "is_end": true},
  "documents": [
    {
      "address_name": "서울 마포구 양화로 160",
      "x": "126.9245",
      "y": "37.5571",
      "address_type": "ROAD_ADDR"
    }
  ]
}
```

`backend/tests/fixtures/kakao_keyword_empty.json`:
```json
{"meta": {"total_count": 0, "pageable_count": 0, "is_end": true}, "documents": []}
```

- [ ] **Step 2: 실패하는 테스트 작성 (geocoder)**

`backend/tests/test_geocoder.py`:
```python
import json
from pathlib import Path

import httpx
import pytest
import respx

from app.geocoding.kakao import GeoPoint, KakaoGeocoder

FIXTURES = Path(__file__).parent / "fixtures"
ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@respx.mock
def test_geocode_uses_address_search_first():
    route = respx.get(ADDRESS_URL).mock(return_value=httpx.Response(200, json=_load("kakao_address.json")))
    geocoder = KakaoGeocoder(rest_key="test-key")
    point = geocoder.geocode("서울 마포구 양화로 160")
    assert point == GeoPoint(lat=37.5571, lng=126.9245)
    assert route.called
    assert route.calls.last.request.headers["Authorization"] == "KakaoAK test-key"


@respx.mock
def test_geocode_falls_back_to_keyword_search():
    respx.get(ADDRESS_URL).mock(return_value=httpx.Response(200, json=_load("kakao_keyword_empty.json")))
    keyword = respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json=_load("kakao_address.json")))
    point = KakaoGeocoder(rest_key="k").geocode("홍대 놀이터")
    assert point is not None
    assert keyword.called


@respx.mock
def test_geocode_returns_none_when_nothing_found():
    respx.get(ADDRESS_URL).mock(return_value=httpx.Response(200, json=_load("kakao_keyword_empty.json")))
    respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json=_load("kakao_keyword_empty.json")))
    assert KakaoGeocoder(rest_key="k").geocode("없는주소") is None


@respx.mock
def test_geocode_raises_on_http_error():
    respx.get(ADDRESS_URL).mock(return_value=httpx.Response(500))
    with pytest.raises(httpx.HTTPStatusError):
        KakaoGeocoder(rest_key="k").geocode("아무거나")
```

- [ ] **Step 3: 실패하는 테스트 작성 (stations)**

`backend/tests/test_stations.py`:
```python
from app.stations import all_stations, search_stations


def test_all_stations_returns_every_seeded_station(seeded):
    assert len(all_stations(seeded)) == 6


def test_search_matches_partial_name(seeded):
    names = [s.name for s in search_stations(seeded, "홍")]
    assert names == ["홍대입구"]


def test_search_empty_query_returns_nothing(seeded):
    assert search_stations(seeded, "  ") == []


def test_search_respects_limit(seeded):
    assert len(search_stations(seeded, "입구", limit=1)) == 1
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_geocoder.py tests/test_stations.py -v`
Expected: FAIL, `No module named 'app.geocoding.kakao'`, `No module named 'app.stations'`

- [ ] **Step 5: kakao.py 작성**

`backend/app/geocoding/kakao.py`:
```python
from dataclasses import dataclass
from typing import Protocol

import httpx

KAKAO_LOCAL_BASE = "https://dapi.kakao.com/v2/local/search"


@dataclass(frozen=True)
class GeoPoint:
    lat: float
    lng: float


class Geocoder(Protocol):
    def geocode(self, query: str) -> GeoPoint | None: ...


class KakaoGeocoder:
    def __init__(self, rest_key: str, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=5.0)
        self._headers = {"Authorization": f"KakaoAK {rest_key}"}

    def _first_point(self, path: str, query: str) -> GeoPoint | None:
        response = self._client.get(
            f"{KAKAO_LOCAL_BASE}/{path}", params={"query": query, "size": 1}, headers=self._headers
        )
        response.raise_for_status()
        documents = response.json().get("documents", [])
        if not documents:
            return None
        doc = documents[0]
        return GeoPoint(lat=float(doc["y"]), lng=float(doc["x"]))

    def geocode(self, query: str) -> GeoPoint | None:
        query = query.strip()
        if not query:
            return None
        point = self._first_point("address.json", query)
        if point is not None:
            return point
        return self._first_point("keyword.json", query)
```

- [ ] **Step 6: stations.py 작성**

`backend/app/stations.py`:
```python
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Station


def all_stations(session: Session) -> list[Station]:
    return list(session.scalars(select(Station).order_by(Station.id)).all())


def search_stations(session: Session, q: str, limit: int = 10) -> list[Station]:
    term = q.strip()
    if not term:
        return []
    stmt = (
        select(Station)
        .where(Station.name.like(f"%{term}%"))
        .order_by(Station.name, Station.id)
        .limit(limit)
    )
    return list(session.scalars(stmt).all())
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_geocoder.py tests/test_stations.py -v`
Expected: 8 PASS

---

### Task 8: 콘텐츠 캐시

**Files:**
- Create: `backend/app/cache.py`
- Test: `backend/tests/test_cache.py`

**Interfaces:**
- Consumes: `ContentCache` (Task 3)
- Produces: `ContentCacheRepo(session, now: Callable[[], datetime] = utcnow)`, `.get(key: str, ttl: timedelta) -> object | None`, `.get_stale(key: str) -> object | None`, `.set(key: str, payload: object, kind: str, hub_id: int | None = None) -> None`, 상수 `CONTENT_TTL = timedelta(hours=24)`, `VENUE_TTL = timedelta(days=30)`, 함수 `utcnow() -> datetime` (tz 없는 UTC)

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/test_cache.py`:
```python
from datetime import datetime, timedelta

from app.cache import CONTENT_TTL, ContentCacheRepo


class Clock:
    def __init__(self, start: datetime) -> None:
        self.now = start

    def __call__(self) -> datetime:
        return self.now


def test_miss_returns_none(session):
    repo = ContentCacheRepo(session)
    assert repo.get("nope", CONTENT_TTL) is None


def test_set_then_get_hits(session):
    repo = ContentCacheRepo(session)
    repo.set("places:1:food", [{"name": "국밥집"}], kind="food", hub_id=None)
    assert repo.get("places:1:food", CONTENT_TTL) == [{"name": "국밥집"}]


def test_expired_entry_is_a_miss_but_still_stale_readable(session):
    clock = Clock(datetime(2026, 9, 23, 12, 0))
    repo = ContentCacheRepo(session, now=clock)
    repo.set("k", {"v": 1}, kind="food")
    clock.now += timedelta(hours=25)
    assert repo.get("k", CONTENT_TTL) is None
    assert repo.get_stale("k") == {"v": 1}


def test_set_overwrites_existing_key(session):
    repo = ContentCacheRepo(session)
    repo.set("k", 1, kind="food")
    repo.set("k", 2, kind="food")
    assert repo.get("k", CONTENT_TTL) == 2
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_cache.py -v`
Expected: FAIL, `No module named 'app.cache'`

- [ ] **Step 3: cache.py 작성**

`backend/app/cache.py`:
```python
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ContentCache

CONTENT_TTL = timedelta(hours=24)
VENUE_TTL = timedelta(days=30)


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class ContentCacheRepo:
    def __init__(self, session: Session, now: Callable[[], datetime] = utcnow) -> None:
        self._session = session
        self._now = now

    def _row(self, key: str) -> ContentCache | None:
        return self._session.scalar(select(ContentCache).where(ContentCache.cache_key == key))

    def get(self, key: str, ttl: timedelta) -> object | None:
        row = self._row(key)
        if row is None or row.fetched_at + ttl < self._now():
            return None
        return row.payload

    def get_stale(self, key: str) -> object | None:
        row = self._row(key)
        return None if row is None else row.payload

    def set(self, key: str, payload: object, kind: str, hub_id: int | None = None) -> None:
        row = self._row(key)
        if row is None:
            row = ContentCache(cache_key=key, kind=kind, hub_id=hub_id)
            self._session.add(row)
        row.payload = payload
        row.kind = kind
        row.hub_id = hub_id
        row.fetched_at = self._now()
        self._session.commit()
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_cache.py -v`
Expected: 4 PASS

---

### Task 9: 맛집, 카페, 놀거리 (카카오 로컬)

**Files:**
- Create: `backend/app/places/__init__.py`
- Create: `backend/app/places/kakao_local.py`
- Create: `backend/app/places/service.py`
- Create: `backend/tests/fixtures/kakao_category_food.json`
- Create: `backend/tests/fixtures/kakao_keyword_play.json`
- Test: `backend/tests/test_places.py`

**Interfaces:**
- Consumes: `Hub` (Task 3), `KAKAO_LOCAL_BASE` (Task 7), `ContentCacheRepo`, `CONTENT_TTL` (Task 8)
- Produces: `KakaoLocalClient(rest_key, client=None)` with `.category_search(code, lat, lng, radius=600, size=15) -> list[dict]`, `.keyword_search(query, lat, lng, radius=600, size=15) -> list[dict]`
- Produces: `Place(id, name, category, address, distance_m, url, lat, lng)` frozen dataclass, `get_places(hub, kind, client, cache) -> list[Place]` (`kind`는 `"food" | "cafe" | "play"`), 상수 `PLAY_KEYWORDS`, `PLACE_RADIUS_M = 600`

- [ ] **Step 1: 고정 응답 파일 작성**

`backend/tests/fixtures/kakao_category_food.json`:
```json
{
  "meta": {"total_count": 2, "pageable_count": 2, "is_end": true},
  "documents": [
    {
      "id": "100",
      "place_name": "홍대 국밥집",
      "category_name": "음식점 > 한식 > 국밥",
      "road_address_name": "서울 마포구 와우산로 1",
      "address_name": "서울 마포구 서교동 1",
      "distance": "120",
      "place_url": "http://place.map.kakao.com/100",
      "x": "126.9250",
      "y": "37.5560"
    },
    {
      "id": "101",
      "place_name": "합정 파스타",
      "category_name": "음식점 > 양식 > 이탈리안",
      "road_address_name": "",
      "address_name": "서울 마포구 합정동 2",
      "distance": "480",
      "place_url": "http://place.map.kakao.com/101",
      "x": "126.9200",
      "y": "37.5500"
    }
  ]
}
```

`backend/tests/fixtures/kakao_keyword_play.json`:
```json
{
  "meta": {"total_count": 1, "pageable_count": 1, "is_end": true},
  "documents": [
    {
      "id": "200",
      "place_name": "홍대 방탈출카페",
      "category_name": "여가시설 > 방탈출카페",
      "road_address_name": "서울 마포구 어울마당로 3",
      "address_name": "",
      "distance": "300",
      "place_url": "http://place.map.kakao.com/200",
      "x": "126.9230",
      "y": "37.5550"
    }
  ]
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`backend/tests/test_places.py`:
```python
import json
from pathlib import Path

import httpx
import respx

from app.cache import ContentCacheRepo
from app.models import Hub
from app.places.kakao_local import KakaoLocalClient
from app.places.service import PLAY_KEYWORDS, Place, get_places

FIXTURES = Path(__file__).parent / "fixtures"
CATEGORY_URL = "https://dapi.kakao.com/v2/local/search/category.json"
KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@respx.mock
def test_food_maps_documents_to_places(seeded):
    route = respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json=_load("kakao_category_food.json")))
    hub = seeded.get(Hub, 1)
    places = get_places(hub, "food", KakaoLocalClient("k"), ContentCacheRepo(seeded))
    assert route.calls.last.request.url.params["category_group_code"] == "FD6"
    assert places[0] == Place(
        id="100",
        name="홍대 국밥집",
        category="국밥",
        address="서울 마포구 와우산로 1",
        distance_m=120,
        url="http://place.map.kakao.com/100",
        lat=37.5560,
        lng=126.9250,
    )
    # 도로명 주소가 없으면 지번 주소로
    assert places[1].address == "서울 마포구 합정동 2"


@respx.mock
def test_cafe_uses_ce7_code(seeded):
    route = respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json=_load("kakao_category_food.json")))
    get_places(seeded.get(Hub, 1), "cafe", KakaoLocalClient("k"), ContentCacheRepo(seeded))
    assert route.calls.last.request.url.params["category_group_code"] == "CE7"


@respx.mock
def test_play_queries_every_keyword_and_dedupes(seeded):
    route = respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json=_load("kakao_keyword_play.json")))
    places = get_places(seeded.get(Hub, 1), "play", KakaoLocalClient("k"), ContentCacheRepo(seeded))
    assert route.call_count == len(PLAY_KEYWORDS)
    assert [p.id for p in places] == ["200"]


@respx.mock
def test_second_call_is_served_from_cache(seeded):
    route = respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json=_load("kakao_category_food.json")))
    hub = seeded.get(Hub, 1)
    cache = ContentCacheRepo(seeded)
    first = get_places(hub, "food", KakaoLocalClient("k"), cache)
    second = get_places(hub, "food", KakaoLocalClient("k"), cache)
    assert route.call_count == 1
    assert first == second
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_places.py -v`
Expected: FAIL, `No module named 'app.places'`

- [ ] **Step 4: kakao_local.py 작성**

`backend/app/places/__init__.py`: 빈 파일.

`backend/app/places/kakao_local.py`:
```python
import httpx

from app.geocoding.kakao import KAKAO_LOCAL_BASE


class KakaoLocalClient:
    def __init__(self, rest_key: str, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=5.0)
        self._headers = {"Authorization": f"KakaoAK {rest_key}"}

    def _get(self, path: str, params: dict) -> list[dict]:
        response = self._client.get(f"{KAKAO_LOCAL_BASE}/{path}", params=params, headers=self._headers)
        response.raise_for_status()
        return list(response.json().get("documents", []))

    def category_search(
        self, code: str, lat: float, lng: float, radius: int = 600, size: int = 15
    ) -> list[dict]:
        return self._get(
            "category.json",
            {
                "category_group_code": code,
                "x": lng,
                "y": lat,
                "radius": radius,
                "size": size,
                "sort": "distance",
            },
        )

    def keyword_search(
        self, query: str, lat: float, lng: float, radius: int = 600, size: int = 15
    ) -> list[dict]:
        return self._get(
            "keyword.json",
            {"query": query, "x": lng, "y": lat, "radius": radius, "size": size, "sort": "distance"},
        )
```

- [ ] **Step 5: service.py 작성**

`backend/app/places/service.py`:
```python
from dataclasses import asdict, dataclass

from app.cache import CONTENT_TTL, ContentCacheRepo
from app.models import Hub
from app.places.kakao_local import KakaoLocalClient

PLACE_RADIUS_M = 600
CATEGORY_CODES = {"food": "FD6", "cafe": "CE7"}
PLAY_KEYWORDS = ("방탈출", "보드게임카페", "노래방", "볼링장", "만화카페")


@dataclass(frozen=True)
class Place:
    id: str
    name: str
    category: str
    address: str
    distance_m: int
    url: str
    lat: float
    lng: float


def _to_place(doc: dict) -> Place:
    category = doc.get("category_name", "").split(">")[-1].strip()
    address = doc.get("road_address_name") or doc.get("address_name") or ""
    return Place(
        id=str(doc["id"]),
        name=doc["place_name"],
        category=category,
        address=address,
        distance_m=int(doc.get("distance") or 0),
        url=doc.get("place_url", ""),
        lat=float(doc["y"]),
        lng=float(doc["x"]),
    )


def _fetch(hub: Hub, kind: str, client: KakaoLocalClient) -> list[Place]:
    if kind in CATEGORY_CODES:
        docs = client.category_search(CATEGORY_CODES[kind], hub.lat, hub.lng, radius=PLACE_RADIUS_M)
        return [_to_place(d) for d in docs]
    if kind == "play":
        seen: dict[str, Place] = {}
        for keyword in PLAY_KEYWORDS:
            for doc in client.keyword_search(keyword, hub.lat, hub.lng, radius=PLACE_RADIUS_M):
                place = _to_place(doc)
                seen.setdefault(place.id, place)
        return sorted(seen.values(), key=lambda p: p.distance_m)
    raise ValueError(f"unknown place kind: {kind}")


def get_places(hub: Hub, kind: str, client: KakaoLocalClient, cache: ContentCacheRepo) -> list[Place]:
    key = f"places:{hub.id}:{kind}"
    cached = cache.get(key, CONTENT_TTL)
    if cached is not None:
        return [Place(**item) for item in cached]
    places = _fetch(hub, kind, client)
    cache.set(key, [asdict(p) for p in places], kind=kind, hub_id=hub.id)
    return places
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_places.py -v`
Expected: 4 PASS

---

### Task 10: 서울시 문화행사

**Files:**
- Create: `backend/app/events/__init__.py`
- Create: `backend/app/events/seoul.py`
- Create: `backend/app/events/service.py`
- Create: `backend/tests/fixtures/seoul_events.json`
- Test: `backend/tests/test_events_seoul.py`

**Interfaces:**
- Consumes: `Hub` (Task 3), `haversine_km` (Task 2), `ContentCacheRepo`, `CONTENT_TTL` (Task 8)
- Produces: `SeoulEventClient(api_key, client=None)` with `.fetch_all() -> list[dict]`
- Produces: `Event(id, title, place, start_date, end_date, lat, lng, url, image, category, is_free, distance_m)` frozen dataclass, `get_seoul_events(hub, meet_date, client, cache) -> list[Event]`, 상수 `EVENT_RADIUS_KM = 1.5`
- KOPIS용 `get_kopis_events`와 통합 함수 `get_events`는 Task 12에서 이 파일에 추가한다.

- [ ] **Step 1: 고정 응답 파일 작성**

`backend/tests/fixtures/seoul_events.json` (서울시 API 응답 축약. LOT가 경도, LAT가 위도. 세 번째 행은 좌표가 뒤바뀐 실데이터 사례):
```json
{
  "culturalEventInfo": {
    "list_total_count": 3,
    "RESULT": {"CODE": "INFO-000", "MESSAGE": "정상 처리되었습니다"},
    "row": [
      {
        "CODENAME": "전시/미술",
        "TITLE": "홍대 일러스트 페어",
        "PLACE": "KT&G 상상마당",
        "STRTDATE": "2026-09-20 00:00:00.0",
        "END_DATE": "2026-09-30 00:00:00.0",
        "LOT": "126.9222",
        "LAT": "37.5541",
        "ORG_LINK": "https://example.com/fair",
        "MAIN_IMG": "https://example.com/fair.jpg",
        "IS_FREE": "무료"
      },
      {
        "CODENAME": "콘서트",
        "TITLE": "잠실 야외 콘서트",
        "PLACE": "올림픽공원",
        "STRTDATE": "2026-09-26 00:00:00.0",
        "END_DATE": "2026-09-26 00:00:00.0",
        "LOT": "127.1216",
        "LAT": "37.5202",
        "ORG_LINK": "https://example.com/concert",
        "MAIN_IMG": "",
        "IS_FREE": "유료"
      },
      {
        "CODENAME": "축제",
        "TITLE": "좌표뒤바뀐 홍대 축제",
        "PLACE": "홍대 걷고싶은거리",
        "STRTDATE": "2026-09-01 00:00:00.0",
        "END_DATE": "2026-12-31 00:00:00.0",
        "LOT": "37.5563",
        "LAT": "126.9236",
        "ORG_LINK": "",
        "MAIN_IMG": "",
        "IS_FREE": "무료"
      }
    ]
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`backend/tests/test_events_seoul.py`:
```python
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
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_events_seoul.py -v`
Expected: FAIL, `No module named 'app.events'`

- [ ] **Step 4: seoul.py 작성**

`backend/app/events/__init__.py`: 빈 파일.

`backend/app/events/seoul.py`:
```python
import httpx

SEOUL_OPENAPI_BASE = "http://openapi.seoul.go.kr:8088"
PAGE_SIZE = 1000
MAX_PAGES = 10


class SeoulEventClient:
    """서울시 문화행사 정보(culturalEventInfo)를 전부 가져온다. 페이지는 1부터 1000 단위."""

    def __init__(self, api_key: str, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=10.0)
        self._api_key = api_key

    def fetch_all(self) -> list[dict]:
        rows: list[dict] = []
        for page in range(MAX_PAGES):
            start = page * PAGE_SIZE + 1
            end = start + PAGE_SIZE - 1
            url = f"{SEOUL_OPENAPI_BASE}/{self._api_key}/json/culturalEventInfo/{start}/{end}/"
            response = self._client.get(url)
            response.raise_for_status()
            body = response.json().get("culturalEventInfo", {})
            batch = body.get("row", [])
            rows.extend(batch)
            if len(batch) < PAGE_SIZE:
                break
        return rows
```

- [ ] **Step 5: service.py 작성 (서울 부분)**

`backend/app/events/service.py`:
```python
from dataclasses import dataclass
from datetime import date

from app.cache import CONTENT_TTL, ContentCacheRepo
from app.events.seoul import SeoulEventClient
from app.geo import haversine_km
from app.models import Hub

EVENT_RADIUS_KM = 1.5
SEOUL_RAW_KEY = "events:seoul:raw"


@dataclass(frozen=True)
class Event:
    id: str
    title: str
    place: str
    start_date: str  # YYYY-MM-DD
    end_date: str
    lat: float
    lng: float
    url: str
    image: str
    category: str
    is_free: bool
    distance_m: int


def _parse_coords(row: dict) -> tuple[float, float] | None:
    try:
        lat = float(row.get("LAT") or 0)
        lng = float(row.get("LOT") or 0)
    except ValueError:
        return None
    if lat == 0 or lng == 0:
        return None
    # 서울시 데이터는 LAT와 LOT가 뒤바뀐 행이 섞여 있다. 위도는 100을 넘을 수 없다.
    if lat > 100:
        lat, lng = lng, lat
    return lat, lng


def _date_part(value: str) -> str:
    return value[:10]


def _to_event(row: dict, hub: Hub, coords: tuple[float, float]) -> Event:
    lat, lng = coords
    distance_m = int(haversine_km(hub.lat, hub.lng, lat, lng) * 1000)
    return Event(
        id=f"seoul:{row.get('TITLE', '')}:{_date_part(row.get('STRTDATE', ''))}",
        title=row.get("TITLE", ""),
        place=row.get("PLACE", ""),
        start_date=_date_part(row.get("STRTDATE", "")),
        end_date=_date_part(row.get("END_DATE", "")),
        lat=lat,
        lng=lng,
        url=row.get("ORG_LINK", "") or "",
        image=row.get("MAIN_IMG", "") or "",
        category=row.get("CODENAME", ""),
        is_free=(row.get("IS_FREE") == "무료"),
        distance_m=distance_m,
    )


def _open_on(row: dict, meet_date: date) -> bool:
    start = _date_part(row.get("STRTDATE", ""))
    end = _date_part(row.get("END_DATE", ""))
    target = meet_date.isoformat()
    return bool(start) and bool(end) and start <= target <= end


def _seoul_raw(client: SeoulEventClient, cache: ContentCacheRepo) -> list[dict]:
    cached = cache.get(SEOUL_RAW_KEY, CONTENT_TTL)
    if cached is not None:
        return list(cached)
    rows = client.fetch_all()
    cache.set(SEOUL_RAW_KEY, rows, kind="event")
    return rows


def get_seoul_events(
    hub: Hub, meet_date: date, client: SeoulEventClient, cache: ContentCacheRepo
) -> list[Event]:
    events: list[Event] = []
    for row in _seoul_raw(client, cache):
        if not _open_on(row, meet_date):
            continue
        coords = _parse_coords(row)
        if coords is None:
            continue
        if haversine_km(hub.lat, hub.lng, *coords) > EVENT_RADIUS_KM:
            continue
        events.append(_to_event(row, hub, coords))
    return sorted(events, key=lambda e: e.distance_m)
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_events_seoul.py -v`
Expected: 4 PASS

---

### Task 11: 방 API (생성, 조회, 참여, 결과)

**Files:**
- Create: `backend/app/rooms/__init__.py`
- Create: `backend/app/rooms/slug.py`
- Create: `backend/app/schemas.py`
- Create: `backend/app/deps.py`
- Create: `backend/app/rooms/service.py`
- Create: `backend/app/rooms/router.py`
- Modify: `backend/app/main.py` (라우터 등록)
- Test: `backend/tests/test_slug.py`
- Test: `backend/tests/test_rooms_api.py`

**Interfaces:**
- Consumes: 모델 (Task 3), `nearest_stations`, `StationWalk` (Task 4), `StationTimeMatrix` (Task 5), `rank_hubs`, `ParticipantInput`, `HubCandidate` (Task 6), `Geocoder`, `GeoPoint`, `KakaoGeocoder` (Task 7), `all_stations`, `search_stations` (Task 7), `round_coord`, `is_in_metro` (Task 2), `utcnow` (Task 8)
- Produces: `generate_slug(length: int = 6) -> str`, 상수 `SLUG_ALPHABET`
- Produces: 의존성 `get_geocoder() -> Geocoder`, `get_matrix(session) -> StationTimeMatrix`, 함수 `hub_node_ids(session) -> set[int]`
- Produces: 엔드포인트 `POST /rooms`, `GET /rooms/{slug}`, `POST /rooms/{slug}/participants`, `GET /rooms/{slug}/result`, `GET /stations?q=`
- Produces: 스키마 `RoomCreate`, `RoomOut`, `ParticipantCreate`, `ParticipantOut`, `ResultOut`, `RecommendationOut`, `LegOut`, `StationOut`
- 에러 문구 (설계 8절 그대로): 주소 실패 `"주소를 찾지 못했어요. 역을 직접 골라주세요."`, 수도권 밖 `"아직 수도권만 지원해요"`, 만료 `"약속이 지난 방이에요"`

- [ ] **Step 1: 실패하는 테스트 작성 (slug)**

`backend/tests/test_slug.py`:
```python
from app.rooms.slug import SLUG_ALPHABET, generate_slug


def test_slug_has_requested_length():
    assert len(generate_slug()) == 6
    assert len(generate_slug(8)) == 8


def test_slug_uses_unambiguous_alphabet():
    for _ in range(200):
        assert set(generate_slug()) <= set(SLUG_ALPHABET)
    for banned in "0oO1lI":
        assert banned not in SLUG_ALPHABET


def test_slugs_are_not_all_identical():
    assert len({generate_slug() for _ in range(50)}) > 1
```

- [ ] **Step 2: slug.py 작성 후 통과 확인**

`backend/app/rooms/__init__.py`: 빈 파일.

`backend/app/rooms/slug.py`:
```python
import secrets

# 0/o/O, 1/l/I 처럼 헷갈리는 글자는 뺀다.
SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def generate_slug(length: int = 6) -> str:
    return "".join(secrets.choice(SLUG_ALPHABET) for _ in range(length))
```

Run: `.venv/Scripts/pytest tests/test_slug.py -v`
Expected: 3 PASS

- [ ] **Step 3: 실패하는 테스트 작성 (rooms API)**

`backend/tests/test_rooms_api.py`:
```python
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import get_db
from app.deps import get_geocoder, get_matrix
from app.geocoding.kakao import GeoPoint
from app.main import create_app
from app.models import Room
from app.transit.matrix import StationTimeMatrix


class FakeGeocoder:
    POINTS = {
        "홍대 근처": GeoPoint(37.5576, 126.9250),
        "수원역 근처": GeoPoint(37.2665, 127.0005),
        "잠실 근처": GeoPoint(37.5130, 127.1005),
        "부산 서면": GeoPoint(35.1579, 129.0594),
    }

    def geocode(self, query: str) -> GeoPoint | None:
        return self.POINTS.get(query)


@pytest.fixture
def client(seeded):
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: FakeGeocoder()
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    return TestClient(app)


def _create_room(client, title="금요일 저녁", meet_date="2026-09-26"):
    response = client.post("/rooms", json={"title": title, "meet_date": meet_date})
    assert response.status_code == 201, response.text
    return response.json()


def _room_row(session, slug: str) -> Room:
    return session.scalar(select(Room).where(Room.slug == slug))


def test_create_room_returns_slug_and_expiry(client):
    room = _create_room(client)
    assert len(room["slug"]) == 6
    assert room["title"] == "금요일 저녁"
    assert room["meet_date"] == "2026-09-26"
    assert room["expires_at"].startswith("2026-10-03")
    assert room["participants"] == []


def test_create_room_rejects_empty_title(client):
    response = client.post("/rooms", json={"title": "", "meet_date": "2026-09-26"})
    assert response.status_code == 422


def test_unknown_room_is_404(client):
    assert client.get("/rooms/zzzzzz").status_code == 404


def test_join_by_address_stores_rounded_coords_and_nearest_station(client, seeded):
    slug = _create_room(client)["slug"]
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "지수", "address": "홍대 근처"})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["nickname"] == "지수"
    assert body["nearest_station_name"] == "홍대입구"
    assert body["via"] == "walk"
    stored = _room_row(seeded, slug).participants[0]
    assert stored.lat == 37.558 and stored.lng == 126.925
    assert not hasattr(stored, "address")


def test_join_by_station_id(client):
    slug = _create_room(client)["slug"]
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "민준", "station_id": 3})
    assert response.status_code == 201
    assert response.json()["nearest_station_name"] == "잠실"


def test_join_requires_address_or_station(client):
    slug = _create_room(client)["slug"]
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "민준"})
    assert response.status_code == 422


def test_join_with_unknown_address_returns_friendly_error(client):
    slug = _create_room(client)["slug"]
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "a", "address": "없는곳"})
    assert response.status_code == 422
    assert response.json()["detail"] == "주소를 찾지 못했어요. 역을 직접 골라주세요."


def test_join_outside_metro_is_rejected(client):
    slug = _create_room(client)["slug"]
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "a", "address": "부산 서면"})
    assert response.status_code == 422
    assert response.json()["detail"] == "아직 수도권만 지원해요"


def test_result_is_waiting_with_one_participant(client):
    slug = _create_room(client)["slug"]
    client.post(f"/rooms/{slug}/participants", json={"nickname": "a", "address": "홍대 근처"})
    body = client.get(f"/rooms/{slug}/result").json()
    assert body["status"] == "waiting"
    assert body["recommendations"] == []


def test_result_ranks_hubs_fairly(client):
    slug = _create_room(client)["slug"]
    client.post(f"/rooms/{slug}/participants", json={"nickname": "홍대", "address": "홍대 근처"})
    client.post(f"/rooms/{slug}/participants", json={"nickname": "수원", "address": "수원역 근처"})
    client.post(f"/rooms/{slug}/participants", json={"nickname": "잠실", "address": "잠실 근처"})
    body = client.get(f"/rooms/{slug}/result").json()
    assert body["status"] == "ready"
    names = [r["name"] for r in body["recommendations"]]
    assert names[0] == "강남"
    top = body["recommendations"][0]
    assert top["vibe_summary"] == "어디서든 오기 쉬운 교통 중심"
    assert top["tags"] == ["교통요지", "회식"]
    assert {l["nickname"]: l["origin_station_name"] for l in top["legs"]} == {
        "홍대": "홍대입구", "수원": "수원", "잠실": "잠실"
    }
    assert top["max_minutes"] >= top["spread_minutes"]


def test_expired_room_is_410(client, seeded):
    slug = _create_room(client)["slug"]
    room = _room_row(seeded, slug)
    room.expires_at = datetime(2020, 1, 1)
    seeded.commit()
    response = client.get(f"/rooms/{slug}")
    assert response.status_code == 410
    assert response.json()["detail"] == "약속이 지난 방이에요"


def test_station_search_endpoint(client):
    body = client.get("/stations", params={"q": "입구"}).json()
    assert [s["name"] for s in body] == ["건대입구", "홍대입구"]
    assert set(body[0]) == {"id", "name", "line"}
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_rooms_api.py -v`
Expected: FAIL, `No module named 'app.deps'`

- [ ] **Step 5: schemas.py 작성**

`backend/app/schemas.py`:
```python
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class RoomCreate(BaseModel):
    title: str = Field(min_length=1, max_length=40)
    meet_date: date


class ParticipantCreate(BaseModel):
    nickname: str = Field(min_length=1, max_length=20)
    address: str | None = Field(default=None, max_length=100)
    station_id: int | None = None

    @model_validator(mode="after")
    def _address_or_station(self) -> "ParticipantCreate":
        if not (self.address and self.address.strip()) and self.station_id is None:
            raise ValueError("address 또는 station_id 중 하나는 필요해요")
        return self


class ParticipantOut(BaseModel):
    id: int
    nickname: str
    nearest_station_name: str
    via: str


class RoomOut(BaseModel):
    slug: str
    title: str
    meet_date: date
    expires_at: datetime
    participants: list[ParticipantOut]


class LegOut(BaseModel):
    participant_id: int
    nickname: str
    minutes: int
    origin_station_name: str
    via: str


class RecommendationOut(BaseModel):
    hub_id: int
    name: str
    region: str
    tags: list[str]
    vibe_summary: str
    lat: float
    lng: float
    max_minutes: int
    spread_minutes: int
    legs: list[LegOut]


class ResultOut(BaseModel):
    status: Literal["waiting", "ready"]
    recommendations: list[RecommendationOut]


class StationOut(BaseModel):
    id: int
    name: str
    line: str
```

- [ ] **Step 6: deps.py 작성**

`backend/app/deps.py`:
```python
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.geocoding.kakao import Geocoder, KakaoGeocoder
from app.models import Hub, Station
from app.transit.matrix import StationTimeMatrix


def get_geocoder() -> Geocoder:
    return KakaoGeocoder(get_settings().kakao_rest_key)


def hub_node_ids(session: Session) -> set[int]:
    """거점과 같은 이름을 가진 모든 역 노드 id. 환승역은 노선별로 노드가 따로 있다."""
    hub_names = set(session.scalars(select(Hub.name)).all())
    stmt = select(Station.id).where(Station.name.in_(hub_names))
    return set(session.scalars(stmt).all())


_matrix_holder: dict[str, StationTimeMatrix] = {}


def get_matrix(session: Session = Depends(get_db)) -> StationTimeMatrix:
    """시간표는 정적 데이터라 프로세스당 한 번만 읽는다. 데이터 갱신 후에는 재시작한다."""
    matrix = _matrix_holder.get("matrix")
    if matrix is None:
        matrix = StationTimeMatrix.load(session, hub_node_ids(session))
        _matrix_holder["matrix"] = matrix
    return matrix
```

- [ ] **Step 7: rooms/service.py 작성**

`backend/app/rooms/service.py`:
```python
from dataclasses import asdict
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cache import utcnow
from app.geo import is_in_metro, round_coord
from app.geocoding.kakao import Geocoder
from app.geocoding.nearest import StationWalk, nearest_stations
from app.models import Hub, Participant, Room, Station
from app.ranking.rank import HubCandidate, ParticipantInput, rank_hubs
from app.rooms.slug import generate_slug
from app.schemas import (
    LegOut,
    ParticipantCreate,
    ParticipantOut,
    RecommendationOut,
    ResultOut,
    RoomCreate,
    RoomOut,
)
from app.stations import all_stations
from app.transit.matrix import StationTimeMatrix

ROOM_KEEP_DAYS = 7
SLUG_RETRIES = 5

MSG_ADDRESS_NOT_FOUND = "주소를 찾지 못했어요. 역을 직접 골라주세요."
MSG_OUTSIDE_METRO = "아직 수도권만 지원해요"
MSG_EXPIRED = "약속이 지난 방이에요"
MSG_ROOM_NOT_FOUND = "방을 찾을 수 없어요"
MSG_STATION_NOT_FOUND = "역을 찾을 수 없어요"


def _unique_slug(session: Session) -> str:
    for _ in range(SLUG_RETRIES):
        slug = generate_slug()
        if session.scalar(select(Room.id).where(Room.slug == slug)) is None:
            return slug
    return generate_slug(8)


def create_room(session: Session, data: RoomCreate) -> Room:
    now = utcnow()
    expires = datetime.combine(data.meet_date, datetime.min.time()) + timedelta(days=ROOM_KEEP_DAYS)
    room = Room(
        slug=_unique_slug(session),
        title=data.title.strip(),
        meet_date=data.meet_date,
        created_at=now,
        expires_at=expires,
    )
    session.add(room)
    session.commit()
    session.refresh(room)
    return room


def get_room(session: Session, slug: str) -> Room:
    room = session.scalar(select(Room).where(Room.slug == slug))
    if room is None:
        raise HTTPException(status_code=404, detail=MSG_ROOM_NOT_FOUND)
    if room.expires_at < utcnow():
        raise HTTPException(status_code=410, detail=MSG_EXPIRED)
    return room


def _resolve_point(session: Session, data: ParticipantCreate, geocoder: Geocoder) -> tuple[float, float]:
    if data.station_id is not None:
        station = session.get(Station, data.station_id)
        if station is None:
            raise HTTPException(status_code=404, detail=MSG_STATION_NOT_FOUND)
        return station.lat, station.lng
    point = geocoder.geocode(data.address or "")
    if point is None:
        raise HTTPException(status_code=422, detail=MSG_ADDRESS_NOT_FOUND)
    return point.lat, point.lng


def add_participant(
    session: Session, room: Room, data: ParticipantCreate, geocoder: Geocoder
) -> Participant:
    lat, lng = _resolve_point(session, data, geocoder)
    if not is_in_metro(lat, lng):
        raise HTTPException(status_code=422, detail=MSG_OUTSIDE_METRO)
    nearest = nearest_stations(lat, lng, all_stations(session))
    participant = Participant(
        room_id=room.id,
        nickname=data.nickname.strip(),
        lat=round_coord(lat),
        lng=round_coord(lng),
        nearest_stations=[asdict(n) for n in nearest],
        created_at=utcnow(),
    )
    session.add(participant)
    session.commit()
    session.refresh(participant)
    session.refresh(room)
    return participant


def participant_out(p: Participant) -> ParticipantOut:
    first = p.nearest_stations[0] if p.nearest_stations else {"station_name": "", "via": "walk"}
    return ParticipantOut(
        id=p.id, nickname=p.nickname, nearest_station_name=first["station_name"], via=first["via"]
    )


def room_out(room: Room) -> RoomOut:
    return RoomOut(
        slug=room.slug,
        title=room.title,
        meet_date=room.meet_date,
        expires_at=room.expires_at,
        participants=[participant_out(p) for p in room.participants],
    )


def _candidates(session: Session) -> tuple[list[Hub], list[HubCandidate]]:
    hubs = list(session.scalars(select(Hub).order_by(Hub.id)).all())
    nodes_by_name: dict[str, list[int]] = {}
    for s in all_stations(session):
        nodes_by_name.setdefault(s.name, []).append(s.id)
    candidates = [HubCandidate(h.id, h.name, tuple(nodes_by_name.get(h.name, ()))) for h in hubs]
    return hubs, candidates


def compute_result(session: Session, room: Room, matrix: StationTimeMatrix) -> ResultOut:
    if len(room.participants) < 2:
        return ResultOut(status="waiting", recommendations=[])
    inputs = [
        ParticipantInput(p.id, p.nickname, tuple(StationWalk(**d) for d in p.nearest_stations))
        for p in room.participants
    ]
    hubs, candidates = _candidates(session)
    hub_by_id = {h.id: h for h in hubs}
    scores = rank_hubs(inputs, candidates, matrix)
    recommendations = [
        RecommendationOut(
            hub_id=s.hub_id,
            name=s.name,
            region=hub_by_id[s.hub_id].region,
            tags=list(hub_by_id[s.hub_id].tags),
            vibe_summary=hub_by_id[s.hub_id].vibe_summary,
            lat=hub_by_id[s.hub_id].lat,
            lng=hub_by_id[s.hub_id].lng,
            max_minutes=s.max_minutes,
            spread_minutes=s.spread_minutes,
            legs=[
                LegOut(
                    participant_id=l.participant_id,
                    nickname=l.nickname,
                    minutes=l.leg.total_minutes,
                    origin_station_name=l.leg.origin_station_name,
                    via=l.leg.via,
                )
                for l in s.legs
            ],
        )
        for s in scores
    ]
    return ResultOut(status="ready", recommendations=recommendations)
```

- [ ] **Step 8: rooms/router.py 작성**

`backend/app/rooms/router.py`:
```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_geocoder, get_matrix
from app.geocoding.kakao import Geocoder
from app.rooms import service
from app.schemas import (
    ParticipantCreate,
    ParticipantOut,
    ResultOut,
    RoomCreate,
    RoomOut,
    StationOut,
)
from app.stations import search_stations
from app.transit.matrix import StationTimeMatrix

router = APIRouter()


@router.post("/rooms", response_model=RoomOut, status_code=201)
def create_room(data: RoomCreate, db: Session = Depends(get_db)) -> RoomOut:
    return service.room_out(service.create_room(db, data))


@router.get("/rooms/{slug}", response_model=RoomOut)
def get_room(slug: str, db: Session = Depends(get_db)) -> RoomOut:
    return service.room_out(service.get_room(db, slug))


@router.post("/rooms/{slug}/participants", response_model=ParticipantOut, status_code=201)
def add_participant(
    slug: str,
    data: ParticipantCreate,
    db: Session = Depends(get_db),
    geocoder: Geocoder = Depends(get_geocoder),
) -> ParticipantOut:
    room = service.get_room(db, slug)
    return service.participant_out(service.add_participant(db, room, data, geocoder))


@router.get("/rooms/{slug}/result", response_model=ResultOut)
def get_result(
    slug: str,
    db: Session = Depends(get_db),
    matrix: StationTimeMatrix = Depends(get_matrix),
) -> ResultOut:
    room = service.get_room(db, slug)
    return service.compute_result(db, room, matrix)


@router.get("/stations", response_model=list[StationOut])
def stations(q: str = Query(default="", max_length=20), db: Session = Depends(get_db)) -> list[StationOut]:
    return [StationOut(id=s.id, name=s.name, line=s.line) for s in search_stations(db, q)]
```

- [ ] **Step 9: main.py에 라우터 등록**

`backend/app/main.py` 상단 import에 추가:
```python
from app.rooms.router import router as rooms_router
```

`create_app` 안, `/health` 정의 뒤 `return app` 앞에 추가:
```python
    app.include_router(rooms_router)
```

- [ ] **Step 10: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_rooms_api.py -v`
Expected: 12 PASS

- [ ] **Step 11: 전체 테스트 실행**

Run: `.venv/Scripts/pytest -q`
Expected: 지금까지 작성한 테스트 전부 PASS

---

### Task 12: 거점 콘텐츠 엔드포인트와 KOPIS

**Files:**
- Create: `backend/app/events/kopis.py`
- Modify: `backend/app/events/service.py` (KOPIS 함수와 `get_events` 통합 함수 추가)
- Modify: `backend/app/deps.py` (`get_local_client`, `get_seoul_client`, `get_kopis_client`, `get_cache` 추가)
- Modify: `backend/app/rooms/router.py` (콘텐츠 엔드포인트 추가)
- Create: `backend/tests/fixtures/kopis_list.xml`
- Create: `backend/tests/fixtures/kopis_facility.xml`
- Test: `backend/tests/test_events_kopis.py`
- Test: `backend/tests/test_content_api.py`

**Interfaces:**
- Consumes: `Event`, `get_seoul_events`, `EVENT_RADIUS_KM` (Task 10), `get_places`, `Place` (Task 9), `ContentCacheRepo`, `CONTENT_TTL`, `VENUE_TTL` (Task 8)
- Produces: `KopisClient(api_key, client=None)` with `.list_performances(meet_date: date, area_code: str) -> list[dict]` (키: `mt20id`, `prfnm`, `fcltynm`, `prfpdfrom`, `prfpdto`, `poster`, `genrenm`, `mt10id`), `.facility(mt10id: str) -> dict` (키: `mt10id`, `fcltynm`, `la`, `lo`)
- Produces: `get_kopis_events(hub, meet_date, client, cache) -> list[Event]`, `get_events(hub, meet_date, seoul_client, kopis_client, cache) -> list[Event]` (서울 거점은 서울시 API, 그 외는 KOPIS), 상수 `KOPIS_AREA_BY_REGION = {"경기": "41", "인천": "28"}`
- Produces: 엔드포인트 `GET /rooms/{slug}/hubs/{hub_id}/content?kind=food|cafe|play|event` 응답 `{"kind": str, "items": list, "error": str | None}`. 외부 API 실패 시 `error = "지금 불러올 수 없어요"`, items는 만료된 캐시가 있으면 그 값, 없으면 빈 목록.

- [ ] **Step 1: 고정 응답 파일 작성**

`backend/tests/fixtures/kopis_list.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<dbs>
  <db>
    <mt20id>PF001</mt20id>
    <prfnm>수원 재즈 나이트</prfnm>
    <prfpdfrom>2026.09.26</prfpdfrom>
    <prfpdto>2026.09.26</prfpdto>
    <fcltynm>수원 SK아트리움</fcltynm>
    <poster>http://example.com/jazz.jpg</poster>
    <genrenm>대중음악</genrenm>
    <mt10id>FC001</mt10id>
  </db>
  <db>
    <mt20id>PF002</mt20id>
    <prfnm>멀리 있는 공연</prfnm>
    <prfpdfrom>2026.09.20</prfpdfrom>
    <prfpdto>2026.09.30</prfpdto>
    <fcltynm>먼 공연장</fcltynm>
    <poster></poster>
    <genrenm>연극</genrenm>
    <mt10id>FC002</mt10id>
  </db>
</dbs>
```

`backend/tests/fixtures/kopis_facility.xml` (FC001용. FC002는 테스트 안에서 문자열로 만든다):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<dbs>
  <db>
    <mt10id>FC001</mt10id>
    <fcltynm>수원 SK아트리움</fcltynm>
    <la>37.2700</la>
    <lo>127.0050</lo>
  </db>
</dbs>
```

- [ ] **Step 2: 실패하는 테스트 작성 (KOPIS)**

`backend/tests/test_events_kopis.py`:
```python
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
```

- [ ] **Step 3: 실패하는 테스트 작성 (content API)**

`backend/tests/test_content_api.py`:
```python
import json
from pathlib import Path

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.cache import ContentCacheRepo
from app.db import get_db
from app.deps import get_cache, get_geocoder, get_local_client, get_matrix, get_seoul_client
from app.events.seoul import SeoulEventClient
from app.geocoding.kakao import GeoPoint
from app.main import create_app
from app.places.kakao_local import KakaoLocalClient
from app.transit.matrix import StationTimeMatrix

FIXTURES = Path(__file__).parent / "fixtures"
CATEGORY_URL = "https://dapi.kakao.com/v2/local/search/category.json"
SEOUL_PREFIX = "http://openapi.seoul.go.kr:8088/s-key/json/culturalEventInfo/"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class FakeGeocoder:
    def geocode(self, query: str) -> GeoPoint | None:
        return GeoPoint(37.5575, 126.9250)


@pytest.fixture
def client(seeded):
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: FakeGeocoder()
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    app.dependency_overrides[get_local_client] = lambda: KakaoLocalClient("k")
    app.dependency_overrides[get_seoul_client] = lambda: SeoulEventClient("s-key")
    app.dependency_overrides[get_cache] = lambda: ContentCacheRepo(seeded)
    return TestClient(app)


def _room_slug(client) -> str:
    return client.post("/rooms", json={"title": "t", "meet_date": "2026-09-26"}).json()["slug"]


@respx.mock
def test_food_content_returns_items(client):
    respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json=_load("kakao_category_food.json")))
    slug = _room_slug(client)
    body = client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "food"}).json()
    assert body["kind"] == "food"
    assert body["error"] is None
    assert body["items"][0]["name"] == "홍대 국밥집"


@respx.mock
def test_event_content_uses_room_meet_date(client):
    respx.get(url__startswith=SEOUL_PREFIX).mock(return_value=httpx.Response(200, json=_load("seoul_events.json")))
    slug = _room_slug(client)
    body = client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "event"}).json()
    titles = [i["title"] for i in body["items"]]
    assert "홍대 일러스트 페어" in titles


@respx.mock
def test_upstream_failure_returns_friendly_error_and_empty_items(client):
    respx.get(CATEGORY_URL).mock(return_value=httpx.Response(500))
    slug = _room_slug(client)
    response = client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "cafe"})
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["error"] == "지금 불러올 수 없어요"


@respx.mock
def test_upstream_failure_serves_stale_cache_when_present(client, seeded):
    respx.get(CATEGORY_URL).mock(return_value=httpx.Response(500))
    ContentCacheRepo(seeded).set(
        "places:1:cafe",
        [{"id": "1", "name": "옛날카페", "category": "카페", "address": "", "distance_m": 10, "url": "", "lat": 0.0, "lng": 0.0}],
        kind="cafe",
        hub_id=1,
    )
    slug = _room_slug(client)
    body = client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "cafe"}).json()
    # 캐시가 유효하면 그냥 캐시 히트라 error가 없다. 여기서는 히트를 확인한다.
    assert body["items"][0]["name"] == "옛날카페"


def test_invalid_kind_is_422(client):
    slug = _room_slug(client)
    assert client.get(f"/rooms/{slug}/hubs/1/content", params={"kind": "bar"}).status_code == 422


def test_unknown_hub_is_404(client):
    slug = _room_slug(client)
    assert client.get(f"/rooms/{slug}/hubs/999/content", params={"kind": "food"}).status_code == 404
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_events_kopis.py tests/test_content_api.py -v`
Expected: FAIL, `No module named 'app.events.kopis'`, `cannot import name 'get_cache'`

- [ ] **Step 5: kopis.py 작성**

`backend/app/events/kopis.py`:
```python
import xml.etree.ElementTree as ET
from datetime import date

import httpx

KOPIS_BASE = "http://www.kopis.or.kr/openApi/restful"
LIST_ROWS = 100
LIST_FIELDS = ("mt20id", "prfnm", "fcltynm", "prfpdfrom", "prfpdto", "poster", "genrenm", "mt10id")
FACILITY_FIELDS = ("mt10id", "fcltynm", "la", "lo")


def _rows(xml_text: str, fields: tuple[str, ...]) -> list[dict]:
    root = ET.fromstring(xml_text)
    return [{f: (db.findtext(f) or "").strip() for f in fields} for db in root.findall("db")]


class KopisClient:
    def __init__(self, api_key: str, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=10.0)
        self._api_key = api_key

    def list_performances(self, meet_date: date, area_code: str) -> list[dict]:
        ymd = meet_date.strftime("%Y%m%d")
        response = self._client.get(
            f"{KOPIS_BASE}/pblprfr",
            params={
                "service": self._api_key,
                "stdate": ymd,
                "eddate": ymd,
                "cpage": 1,
                "rows": LIST_ROWS,
                "signgucode": area_code,
            },
        )
        response.raise_for_status()
        return _rows(response.text, LIST_FIELDS)

    def facility(self, mt10id: str) -> dict:
        response = self._client.get(f"{KOPIS_BASE}/prfplc/{mt10id}", params={"service": self._api_key})
        response.raise_for_status()
        rows = _rows(response.text, FACILITY_FIELDS)
        return rows[0] if rows else {}
```

- [ ] **Step 6: events/service.py에 KOPIS와 통합 함수 추가**

`backend/app/events/service.py` 상단 import를 다음으로 바꾼다:
```python
from dataclasses import dataclass
from datetime import date

from app.cache import CONTENT_TTL, VENUE_TTL, ContentCacheRepo
from app.events.kopis import KopisClient
from app.events.seoul import SeoulEventClient
from app.geo import haversine_km
from app.models import Hub
```

파일 끝에 추가:
```python
KOPIS_AREA_BY_REGION = {"경기": "41", "인천": "28"}


def _kopis_dot_date(value: str) -> str:
    return value.replace(".", "-")


def _venue_coords(mt10id: str, client: KopisClient, cache: ContentCacheRepo) -> tuple[float, float] | None:
    if not mt10id:
        return None
    key = f"venue:kopis:{mt10id}"
    cached = cache.get(key, VENUE_TTL)
    if cached is None:
        facility = client.facility(mt10id)
        cached = {"la": facility.get("la", ""), "lo": facility.get("lo", "")}
        cache.set(key, cached, kind="venue")
    try:
        lat, lng = float(cached["la"]), float(cached["lo"])
    except (TypeError, ValueError, KeyError):
        return None
    if lat == 0 or lng == 0:
        return None
    return lat, lng


def get_kopis_events(
    hub: Hub, meet_date: date, client: KopisClient, cache: ContentCacheRepo
) -> list[Event]:
    area = KOPIS_AREA_BY_REGION.get(hub.region)
    if area is None:
        return []
    key = f"events:kopis:{area}:{meet_date.isoformat()}"
    rows = cache.get(key, CONTENT_TTL)
    if rows is None:
        rows = client.list_performances(meet_date, area)
        cache.set(key, rows, kind="event")
    events: list[Event] = []
    for row in rows:
        coords = _venue_coords(row.get("mt10id", ""), client, cache)
        if coords is None:
            continue
        km = haversine_km(hub.lat, hub.lng, *coords)
        if km > EVENT_RADIUS_KM:
            continue
        mt20id = row.get("mt20id", "")
        events.append(
            Event(
                id=f"kopis:{mt20id}",
                title=row.get("prfnm", ""),
                place=row.get("fcltynm", ""),
                start_date=_kopis_dot_date(row.get("prfpdfrom", "")),
                end_date=_kopis_dot_date(row.get("prfpdto", "")),
                lat=coords[0],
                lng=coords[1],
                url=f"https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?mt20Id={mt20id}",
                image=row.get("poster", ""),
                category=row.get("genrenm", ""),
                is_free=False,
                distance_m=int(km * 1000),
            )
        )
    return sorted(events, key=lambda e: e.distance_m)


def get_events(
    hub: Hub,
    meet_date: date,
    seoul_client: SeoulEventClient,
    kopis_client: KopisClient,
    cache: ContentCacheRepo,
) -> list[Event]:
    if hub.region == "서울":
        return get_seoul_events(hub, meet_date, seoul_client, cache)
    return get_kopis_events(hub, meet_date, kopis_client, cache)
```

- [ ] **Step 7: deps.py에 클라이언트 의존성 추가**

`backend/app/deps.py` 상단 import에 추가:
```python
from app.cache import ContentCacheRepo
from app.events.kopis import KopisClient
from app.events.seoul import SeoulEventClient
from app.places.kakao_local import KakaoLocalClient
```

파일 끝에 추가:
```python
def get_local_client() -> KakaoLocalClient:
    return KakaoLocalClient(get_settings().kakao_rest_key)


def get_seoul_client() -> SeoulEventClient:
    return SeoulEventClient(get_settings().seoul_api_key)


def get_kopis_client() -> KopisClient:
    return KopisClient(get_settings().kopis_api_key)


def get_cache(session: Session = Depends(get_db)) -> ContentCacheRepo:
    return ContentCacheRepo(session)
```

- [ ] **Step 8: router.py에 콘텐츠 엔드포인트 추가**

`backend/app/rooms/router.py` 상단 import에 추가:
```python
from dataclasses import asdict
from typing import Literal

import httpx
from fastapi import HTTPException

from app.cache import ContentCacheRepo
from app.deps import get_cache, get_kopis_client, get_local_client, get_seoul_client
from app.events.kopis import KopisClient
from app.events.seoul import SeoulEventClient
from app.events.service import get_events
from app.models import Hub
from app.places.kakao_local import KakaoLocalClient
from app.places.service import get_places
```

파일 끝에 추가:
```python
MSG_CONTENT_UNAVAILABLE = "지금 불러올 수 없어요"
MSG_HUB_NOT_FOUND = "거점을 찾을 수 없어요"
ContentKind = Literal["food", "cafe", "play", "event"]


@router.get("/rooms/{slug}/hubs/{hub_id}/content")
def hub_content(
    slug: str,
    hub_id: int,
    kind: ContentKind,
    db: Session = Depends(get_db),
    local_client: KakaoLocalClient = Depends(get_local_client),
    seoul_client: SeoulEventClient = Depends(get_seoul_client),
    kopis_client: KopisClient = Depends(get_kopis_client),
    cache: ContentCacheRepo = Depends(get_cache),
) -> dict:
    room = service.get_room(db, slug)
    hub = db.get(Hub, hub_id)
    if hub is None:
        raise HTTPException(status_code=404, detail=MSG_HUB_NOT_FOUND)
    try:
        if kind == "event":
            items = get_events(hub, room.meet_date, seoul_client, kopis_client, cache)
        else:
            items = get_places(hub, kind, local_client, cache)
        return {"kind": kind, "items": [asdict(i) for i in items], "error": None}
    except httpx.HTTPError:
        stale = cache.get_stale(f"places:{hub.id}:{kind}") if kind != "event" else None
        return {"kind": kind, "items": list(stale or []), "error": MSG_CONTENT_UNAVAILABLE}
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_events_kopis.py tests/test_content_api.py -v`
Expected: 9 PASS

- [ ] **Step 10: 전체 테스트 실행**

Run: `.venv/Scripts/pytest -q`
Expected: 전부 PASS

---

### Task 13: 운영 스크립트와 README

**Files:**
- Create: `backend/scripts/__init__.py`
- Create: `backend/scripts/init_db.py`
- Create: `backend/scripts/cleanup_expired.py`
- Create: `backend/README.md`
- Test: `backend/tests/test_cleanup.py`

**Interfaces:**
- Consumes: `Base`, `Room`, `Participant` (Task 3), `utcnow` (Task 8), `engine`, `SessionLocal` (Task 3)
- Produces: `delete_expired_rooms(session, now: datetime) -> int` (삭제한 방 수)

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/test_cleanup.py`:
```python
from datetime import date, datetime

from sqlalchemy import select

from app.models import Participant, Room
from scripts.cleanup_expired import delete_expired_rooms


def _room(slug: str, expires: datetime) -> Room:
    return Room(slug=slug, title="t", meet_date=date(2026, 9, 1), created_at=expires, expires_at=expires)


def test_deletes_only_expired_rooms_and_their_participants(session):
    old = _room("old001", datetime(2026, 9, 1))
    new = _room("new001", datetime(2027, 1, 1))
    session.add_all([old, new])
    session.flush()
    session.add(
        Participant(
            room_id=old.id, nickname="a", lat=0, lng=0, nearest_stations=[], created_at=datetime(2026, 8, 1)
        )
    )
    session.commit()

    deleted = delete_expired_rooms(session, now=datetime(2026, 9, 23))

    assert deleted == 1
    assert [r.slug for r in session.scalars(select(Room)).all()] == ["new001"]
    assert session.scalars(select(Participant)).all() == []
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_cleanup.py -v`
Expected: FAIL, `No module named 'scripts'`

- [ ] **Step 3: 스크립트 작성**

`backend/scripts/__init__.py`: 빈 파일.

`backend/scripts/cleanup_expired.py`:
```python
"""만료된 방을 지운다. Railway cron에서 하루 한 번 실행한다.

실행: python -m scripts.cleanup_expired
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cache import utcnow
from app.db import SessionLocal
from app.models import Room


def delete_expired_rooms(session: Session, now: datetime) -> int:
    expired = session.scalars(select(Room).where(Room.expires_at < now)).all()
    for room in expired:
        session.delete(room)  # participants는 cascade로 함께 삭제
    session.commit()
    return len(expired)


if __name__ == "__main__":
    with SessionLocal() as s:
        count = delete_expired_rooms(s, utcnow())
    print(f"deleted {count} expired rooms")
```

`backend/scripts/init_db.py`:
```python
"""테이블을 만든다. 처음 배포할 때와 로컬 개발 시작할 때 한 번 실행한다.

실행: python -m scripts.init_db
"""

from app.db import engine
from app.models import Base

if __name__ == "__main__":
    Base.metadata.create_all(engine)
    print("tables created")
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_cleanup.py -v`
Expected: PASS

- [ ] **Step 5: README 작성**

`backend/README.md`:
````markdown
# 우리지금만나 백엔드

## 로컬 실행

```bash
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"
copy .env.example .env
.venv/Scripts/python -m scripts.init_db
.venv/Scripts/uvicorn app.main:app --reload
```

`.env`에 키를 채운 뒤 실행한다. API 문서: http://localhost:8000/docs

## 테스트

```bash
.venv/Scripts/pytest -q
```

## 환경 변수

| 이름 | 설명 |
|---|---|
| DATABASE_URL | Postgres 연결 문자열. 로컬 기본값은 sqlite:///./dev.db |
| KAKAO_REST_KEY | 카카오 개발자 콘솔의 REST API 키 (지오코딩, 로컬 검색) |
| SEOUL_API_KEY | 서울 열린데이터광장 인증키 (문화행사) |
| KOPIS_API_KEY | 공연예술통합전산망 서비스키 |
| CORS_ORIGINS | 프론트 주소. 쉼표로 여러 개 |

## 데이터 적재

stations, station_times, hubs 테이블은 별도 데이터 파이프라인 계획(dev/active/transit-data)에서 채운다.
그 전까지는 tests/conftest.py의 시드와 같은 형태로 수동 적재해서 확인할 수 있다.

## 운영

- 만료 방 정리: `python -m scripts.cleanup_expired` 를 하루 한 번 (Railway cron)
- 역간 시간표는 프로세스 시작 후 첫 결과 요청 때 메모리에 올라간다. 데이터 갱신 후에는 재시작한다.
````

- [ ] **Step 6: 전체 테스트와 서버 기동 확인**

Run: `.venv/Scripts/pytest -q`
Expected: 전부 PASS

Run: `.venv/Scripts/python -m scripts.init_db` 후 `.venv/Scripts/uvicorn app.main:app --port 8000` 을 띄운 뒤 다른 터미널에서
```bash
curl -s http://localhost:8000/health
```
Expected: `{"ok":true}`

---

## 이 계획 다음에 올 계획

1. `dev/active/transit-data/`: 수도권 지하철 역 좌표와 역간 소요시간 공공데이터 수집, 그래프 생성, 다익스트라 전 쌍 계산, stations/station_times 적재, 만남 거점 100곳 큐레이션 시드
2. `dev/active/frontend/`: Next.js 화면 3개 (방 만들기, 참여, 결과), 카카오맵, 10초 폴링, Vercel 배포
