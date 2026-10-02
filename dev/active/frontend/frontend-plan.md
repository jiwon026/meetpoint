# frontend 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화면 4개(방 만들기, 참여, 거점 추천, 거점 주변)짜리 Next.js 프론트를 만들고, 그 화면이 쓰는 백엔드 보강(지역, 테마, 주소 검색, 노선 목록, 참가자 빼기)을 넣어 로컬에서 끝까지 돌게 한다.

**Architecture:** 백엔드는 기존 구조(얇은 라우터, 서비스에 로직, 클라이언트 클래스 안에서만 외부 호출)를 그대로 따른다. 프론트는 브라우저가 FastAPI를 직접 호출하고 TanStack Query로 10초 폴링한다. 화면 로직은 `components/*/*Screen.tsx`에 두고 `app/` 페이지는 URL을 읽어 넘겨주는 얇은 껍데기로 둔다 (라우터 없이 컴포넌트를 테스트하기 위해). TS 타입은 백엔드 OpenAPI에서 생성한다.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, pytest, respx / Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, TanStack Query 5, react-kakao-maps-sdk, Vitest, Testing Library, MSW 2, Playwright

**Spec:** `docs/frontend-design.md` (상위: `docs/design.md`)

## Global Constraints

- 브랜치 `feat/frontend`. 커밋은 conventional commit 형식, 트레일러 없음.
- 백엔드 명령은 전부 `backend/` 안에서. 테스트는 `.venv/Scripts/pytest`. 한글을 출력하는 스크립트는 `PYTHONIOENCODING=utf-8`을 앞에 붙인다.
- 프론트 명령은 전부 `frontend/` 안에서. 패키지 매니저는 npm.
- 문장 부호: 코드 주석, 화면 문구, 문서, CSV 내용에 엠대시와 가운데 점 금지. 나열은 쉼표, 범위는 물결표.
- 사용자에게 보이는 백엔드 에러 문구는 `app/rooms/service.py`의 `MSG_*`와 `docs/design.md` 8절이 원본. 바꾸거나 추가하면 둘 다 고친다. 프론트는 백엔드 `detail` 문자열을 그대로 보여준다.
- 프론트에서만 쓰는 문구는 `frontend/lib/messages.ts`에 모은다. 컴포넌트에 문구를 직접 쓰지 않는다 (버튼 라벨 같은 짧은 UI 라벨은 예외).
- 외부 HTTP 호출은 백엔드 클라이언트 클래스 안에서만 (`app/places/kakao_local.py`). 서비스와 라우터는 `deps.py`에서 주입받는다.
- SQLite에서 도는 코드가 Postgres에서도 돌아야 한다. 마이그레이션 도구 없음: 스키마가 바뀌면 `dev.db`를 지우고 `init_db`부터.
- 표에 없는 값은 조용히 넘기지 않고 실패시킨다 (파이프라인 원칙). `hubs.csv`의 `themes`에 모르는 값이 있으면 검증이 실패한다.
- 고른 값 세 개는 측정값이 아니다: 테마 허용 오차 5분(`THEME_TOLERANCE_MINUTES`), 테마 상위 30곳(`THEME_TOP_N`), 도보 분당 67m. 앞의 둘은 `backend/data/SOURCES.md`에 근거를 적는다.
- 지역 값은 정확히 `"서울"`, `"경기"`, `"인천"`. 테마 값은 정확히 `"food"`, `"cafe"`, `"drink"`, `"play"`. 테마 끔은 `"any"`.
- 정원 20명은 빠진 사람을 포함한 전체 행 수.
- 프론트 `localStorage`에는 키 `wjm:room:{slug}:mine`(participant id 목록)만 저장한다. `hub_id`, `station_id`는 저장하지 않는다.
- 화면의 시간은 전부 "약 N분".
- 검색어(주소)는 URL 쿼리에 넣지 않는다. `POST /places/search` 본문으로 보낸다 (서버 접근 로그에 남지 않게).
- 모든 테스트는 외부 키 없이 돈다. 백엔드 외부 API는 respx, 프론트는 MSW.
- 프론트 색은 `app/globals.css`의 토큰만 쓴다: `paper #fcf9f5`, `card #ffffff`, `line #e5e2de`, `primary #0f5238`, `primary-soft #2d6a4f`, `primary-tint #b1f0ce`, `accent #b22a1d`, `ink #1c1c1a`, `ink-sub #404943`, `ink-mute #707973`, `track #f0edea`. 컴포넌트에 색 hex를 직접 쓰지 않는다 (노선 색 표 `lib/lines.ts`만 예외).
- 프론트 패키지 버전: `next@16`, `msw@^2`(3이 아니라 2), 나머지는 설치 시점 최신. Next.js API가 이 계획의 코드와 다르게 동작하면 설치된 버전의 공식 문서를 확인하고 맞춘 뒤, 바꾼 점을 `frontend-context.md`에 적는다.
- 기존 백엔드 테스트 214개는 계속 통과해야 한다. 이 계획이 일부러 고치는 테스트는 `tests/pipeline/test_load.py`, `tests/pipeline/test_manual_data.py`, `tests/pipeline/test_run_all_synthetic.py`의 `hubs.csv` 열 목록뿐이다.

## 작업 디렉터리 구조

```
backend/
  app/
    options.py                 [신규] Region, REGIONS, Theme, THEMES, THEME_OFF
    models.py                  Room.regions, Room.theme, Hub.themes, Participant.active
    schemas.py                 RoomCreate/RoomOut 지역과 테마, ResultOut/RecommendationOut 추가 필드, 주소 검색, 참가자 수정
    hubs.py                    load_hub_candidates(stations 인자), hub_lines
    ranking/rank.py            THEME_TOLERANCE_MINUTES, Ranking, rank_with_preference
    rooms/service.py           지역 필터, 테마, 활성 참가자만 계산, set_participant_active
    rooms/router.py            result 쿼리, POST /places/search, PATCH participants
    places/kakao_local.py      suggest
    places/suggest.py          [신규] suggest_places
  pipeline/
    themes.py                  [신규] themes 열 초안 생성
    validate.py                check_hub_themes
    load.py                    themes 적재
  data/manual/hubs.csv         themes 열 추가
  data/SOURCES.md              테마 판정 기준, 5분 근거
  tests/
    test_regions_api.py        [신규]
    test_rank.py               테마 우선 케이스 추가
    test_theme_api.py          [신규]
    test_place_search_api.py   [신규]
    test_participant_active_api.py  [신규]
    pipeline/test_themes.py    [신규]
docs/design.md                 2, 3, 5, 6, 8절 갱신
frontend/                      [신규]
  app/
    globals.css                디자인 토큰
    layout.tsx                 글꼴, 헤더, Providers
    providers.tsx              QueryClientProvider, ToastProvider
    page.tsx                   4.1 방 만들기
    r/[slug]/layout.tsx        링크 미리보기 제목
    r/[slug]/page.tsx          4.2 참여
    r/[slug]/result/page.tsx   4.3 추천
    r/[slug]/hubs/[hubId]/page.tsx  4.4 주변
  components/
    ui/        AppHeader, Chip, Stamp, TicketCard, Toast, LineBadge, StickyAction, StepIndicator
    room/      RegionChips, ThemePicker, CreateRoomForm
    join/      RoomGate, RoomSummary, ShareButtons, OriginSearch, JoinForm, Roster, JoinScreen
    result/    FilterBar, FairnessStats, LegBars, HubCard, ResultScreen
    hub/       HubHeader, PlaceCard, EventCard, ContentTabs, HubScreen
    map/       KakaoMap
  lib/
    constants.ts, messages.ts, regions.ts, themes.ts, lines.ts, format.ts, filter.ts,
    share.ts, myParticipants.ts, useDebounced.ts
    api/       client.ts, types.ts, hooks.ts, schema.d.ts(생성물)
    test/      server.ts, render.tsx, fixtures.ts
  e2e/         start-backend.mjs, flow.spec.ts
  scripts/gen-api.mjs
  vitest.config.ts, vitest.setup.ts, playwright.config.ts, .env.example
.claude/launch.json            frontend 실행 설정 추가
dev/active/frontend/           계획, 컨텍스트, 체크리스트
```

테스트 파일은 대상 파일 옆에 둔다 (`lib/format.test.ts`, `components/join/Roster.test.tsx`).

---

# A. 백엔드

## Task 1: 지역 선택과 지역 필터

**Files:**
- Create: `backend/app/options.py`
- Modify: `backend/app/models.py` (Room)
- Modify: `backend/app/schemas.py` (RoomCreate, RoomOut, ResultOut)
- Modify: `backend/app/rooms/service.py` (create_room, room_out, compute_result)
- Modify: `backend/app/rooms/router.py` (get_result)
- Test: `backend/tests/test_regions_api.py`

**Interfaces:**
- Consumes: 기존 `load_hub_candidates(session) -> (list[Hub], list[HubCandidate])`, `rank_hubs(participants, hubs, matrix, top_n=5)`.
- Produces:
  - `app.options.REGIONS: tuple[str, ...] = ("서울", "경기", "인천")`, `app.options.Region = Literal["서울", "경기", "인천"]`
  - `Room.regions: list[str]`
  - `RoomCreate.regions: list[Region]` (기본 셋 다), `RoomOut.regions: list[str]`, `ResultOut.regions: list[str]`
  - `compute_result(session, room, matrix, regions: Sequence[str] | None = None) -> ResultOut`
  - `GET /rooms/{slug}/result?region=서울&region=경기`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/test_regions_api.py`를 만든다. 기존 시드(서울 거점 4곳)에 신촌(서울)과 수원(경기) 거점을 더해 서울 5곳, 경기 1곳으로 만든다. 홍대입구 출발 두 명 기준으로 수원은 6위라서 상위 5곳에서 잘린다.

```python
import pytest
from fastapi.testclient import TestClient

from app.db import get_db
from app.deps import get_geocoder, get_matrix
from app.main import create_app
from app.models import Hub, Station
from app.transit.matrix import StationTimeMatrix


class NoGeocoder:
    def geocode(self, query: str):
        return None


@pytest.fixture
def client(seeded):
    sinchon = seeded.get(Station, 5)
    suwon = seeded.get(Station, 6)
    seeded.add_all([
        Hub(id=5, station_id=5, group_id=5, name="신촌", lat=sinchon.lat, lng=sinchon.lng,
            region="서울", tags=["대학가"], vibe_summary="대학가 골목이 이어지는 동네"),
        Hub(id=6, station_id=6, group_id=6, name="수원", lat=suwon.lat, lng=suwon.lng,
            region="경기", tags=["교통요지"], vibe_summary="경기 남부에서 모이기 쉬운 곳"),
    ])
    seeded.commit()
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: NoGeocoder()
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4, 5, 6})
    return TestClient(app)


def _room(client, **extra):
    response = client.post("/rooms", json={"title": "주말 모임", "meet_date": "2026-10-10", **extra})
    assert response.status_code == 201, response.text
    return response.json()


def _join_two_from_hongdae(client, slug):
    for nickname in ("가", "나"):
        response = client.post(f"/rooms/{slug}/participants", json={"nickname": nickname, "station_id": 1})
        assert response.status_code == 201, response.text


def _names(body):
    return [r["name"] for r in body["recommendations"]]


def test_room_defaults_to_all_regions(client):
    assert _room(client)["regions"] == ["서울", "경기", "인천"]


def test_room_stores_chosen_regions_in_canonical_order(client):
    assert _room(client, regions=["경기", "서울", "경기"])["regions"] == ["서울", "경기"]


def test_room_rejects_empty_or_unknown_regions(client):
    for bad in ([], ["부산"]):
        response = client.post("/rooms", json={"title": "t", "meet_date": "2026-10-10", "regions": bad})
        assert response.status_code == 422, bad


def test_result_without_filter_uses_all_regions_and_cuts_to_five(client):
    slug = _room(client)["slug"]
    _join_two_from_hongdae(client, slug)
    body = client.get(f"/rooms/{slug}/result").json()
    assert _names(body) == ["홍대입구", "신촌", "건대입구", "강남", "잠실"]
    assert body["regions"] == ["서울", "경기", "인천"]


def test_region_filter_applies_before_top_five_cut(client):
    """수원은 전체 6위라 상위 5곳에서 잘린다. 경기만 고르면 자르기 전에 걸러져서 수원이 나와야 한다."""
    slug = _room(client)["slug"]
    _join_two_from_hongdae(client, slug)
    body = client.get(f"/rooms/{slug}/result", params={"region": "경기"}).json()
    assert body["status"] == "ready"
    assert _names(body) == ["수원"]
    assert body["regions"] == ["경기"]


def test_room_regions_are_the_default_filter_and_query_overrides(client):
    slug = _room(client, regions=["경기"])["slug"]
    _join_two_from_hongdae(client, slug)
    assert _names(client.get(f"/rooms/{slug}/result").json()) == ["수원"]
    widened = client.get(f"/rooms/{slug}/result", params={"region": ["서울", "경기"]}).json()
    assert len(widened["recommendations"]) == 5
    assert widened["regions"] == ["서울", "경기"]


def test_region_with_no_hubs_is_ready_but_empty(client):
    slug = _room(client)["slug"]
    _join_two_from_hongdae(client, slug)
    body = client.get(f"/rooms/{slug}/result", params={"region": "인천"}).json()
    assert body["status"] == "ready"
    assert body["recommendations"] == []


def test_waiting_result_still_reports_regions(client):
    slug = _room(client, regions=["서울"])["slug"]
    body = client.get(f"/rooms/{slug}/result").json()
    assert body["status"] == "waiting"
    assert body["regions"] == ["서울"]


def test_unknown_region_query_is_422(client):
    slug = _room(client)["slug"]
    assert client.get(f"/rooms/{slug}/result", params={"region": "부산"}).status_code == 422
```

기대 순서의 근거 (시드 `tests/conftest.py`의 `TIMES`, 하차 도보 5분): 홍대입구 5분, 신촌 3+5=8분, 건대입구 30+5=35분, 강남 35+5=40분, 잠실 45+5=50분, 수원 80+5=85분.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && .venv/Scripts/pytest tests/test_regions_api.py -q`
Expected: 전부 FAIL. `regions` 키가 응답에 없어서 `KeyError: 'regions'`, 422 기대 테스트는 201 또는 200을 받아 실패.

- [ ] **Step 3: `app/options.py` 작성**

```python
from typing import Literal

Region = Literal["서울", "경기", "인천"]
REGIONS: tuple[str, ...] = ("서울", "경기", "인천")
```

- [ ] **Step 4: 모델과 스키마 수정**

`backend/app/models.py`의 `Room` 클래스에 `expires_at` 아래 한 줄 추가하고, 파일 상단 import에 `from app.options import REGIONS`를 넣는다.

```python
    regions: Mapped[list[str]] = mapped_column(JSON, default=lambda: list(REGIONS))
```

`backend/app/schemas.py`를 고친다. import 줄을 바꾸고:

```python
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.options import REGIONS, Region
```

`RoomCreate`에 필드와 검증기를 추가한다.

```python
class RoomCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=40)
    meet_date: date
    regions: list[Region] = Field(default_factory=lambda: list(REGIONS), min_length=1)

    @field_validator("regions")
    @classmethod
    def _canonical_regions(cls, value: list[str]) -> list[str]:
        # 중복을 없애고 순서를 서울, 경기, 인천으로 고정한다
        return [r for r in REGIONS if r in value]
```

`RoomOut`에 `regions: list[str]`을 `expires_at` 아래에 추가한다. `ResultOut`에 `regions: list[str]`을 추가한다.

```python
class ResultOut(BaseModel):
    status: Literal["waiting", "ready"]
    recommendations: list[RecommendationOut]
    regions: list[str]
```

- [ ] **Step 5: 서비스 수정**

`backend/app/rooms/service.py` 상단 import에 추가:

```python
from collections.abc import Sequence

from app.options import REGIONS
```

`create_room`의 `Room(...)` 생성에 `regions=list(data.regions),`를 추가한다. `room_out`의 `RoomOut(...)`에 `regions=list(room.regions),`를 추가한다.

`compute_result`를 다음으로 바꾼다 (지역 필터는 `rank_hubs` 전에 건다).

```python
def compute_result(
    session: Session,
    room: Room,
    matrix: StationTimeMatrix,
    regions: Sequence[str] | None = None,
) -> ResultOut:
    applied_regions = [r for r in REGIONS if r in (regions or room.regions)]
    if len(room.participants) < 2:
        return ResultOut(status="waiting", recommendations=[], regions=applied_regions)
    inputs = [
        ParticipantInput(p.id, p.nickname, tuple(StationWalk(**d) for d in p.nearest_stations))
        for p in room.participants
    ]
    hubs, candidates = load_hub_candidates(session)
    hub_by_id = {h.id: h for h in hubs}
    # 상위 5곳을 자르기 전에 지역으로 거른다. 자른 뒤 거르면 결과가 비어 보인다.
    in_region = [c for c in candidates if hub_by_id[c.hub_id].region in applied_regions]
    scores = rank_hubs(inputs, in_region, matrix)
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
    return ResultOut(status="ready", recommendations=recommendations, regions=applied_regions)
```

- [ ] **Step 6: 라우터 수정**

`backend/app/rooms/router.py`에 `from app.options import Region`을 추가하고 `get_result`를 바꾼다.

```python
@router.get("/rooms/{slug}/result", response_model=ResultOut)
def get_result(
    slug: str,
    region: list[Region] | None = Query(default=None),
    db: Session = Depends(get_db),
    matrix: StationTimeMatrix = Depends(get_matrix),
) -> ResultOut:
    room = service.get_room(db, slug)
    return service.compute_result(db, room, matrix, regions=region)
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd backend && .venv/Scripts/pytest tests/test_regions_api.py -q`
Expected: 9 passed

Run: `cd backend && .venv/Scripts/pytest -q`
Expected: 223 passed (기존 214 + 9)

- [ ] **Step 8: 커밋**

```bash
git add backend/app/options.py backend/app/models.py backend/app/schemas.py backend/app/rooms/service.py backend/app/rooms/router.py backend/tests/test_regions_api.py
git commit -m "feat: room regions and region filter applied before top five cut"
```

---

## Task 2: 거점 테마 데이터

**Files:**
- Modify: `backend/app/options.py`
- Modify: `backend/app/models.py` (Hub)
- Create: `backend/pipeline/themes.py`
- Modify: `backend/pipeline/validate.py`
- Modify: `backend/pipeline/load.py` (`_hub_rows`)
- Modify: `backend/data/manual/hubs.csv` (스크립트가 `themes` 열 추가)
- Modify: `backend/data/SOURCES.md`
- Test: `backend/tests/pipeline/test_themes.py` (신규)
- Modify tests: `backend/tests/pipeline/test_validate.py`, `test_load.py`, `test_manual_data.py`, `test_run_all_synthetic.py`

**Interfaces:**
- Consumes: `pipeline.io.read_csv_rows(path) -> list[dict[str, str]]`, `pipeline.io.write_csv(path, fieldnames, rows)`, `pipeline.config.MANUAL_DIR`, `pipeline.config.OUT_DIR`. `data/out/hub_candidates.csv`의 열: `group_id,name,region,food,cafe,play,score` (거점 100곳 중 판교는 이 파일에 없다).
- Produces:
  - `app.options.THEMES: tuple[str, ...] = ("food", "cafe", "drink", "play")`, `app.options.Theme`, `app.options.THEME_OFF = "any"`
  - `Hub.themes: list[str]`
  - `pipeline.themes.split_list(value: str) -> list[str]`
  - `pipeline.themes.assign_themes(hubs, candidates, n=THEME_TOP_N) -> list[list[str]]`
  - `pipeline.themes.fill_themes(hubs, candidates, force=False) -> list[dict[str, str]]`
  - `pipeline.validate.check_hub_themes(hubs) -> list[str]`
  - `hubs.csv` 열 순서: `group_id,name,region,tags,themes,vibe_summary`

- [ ] **Step 1: `app/options.py`에 테마 추가**

파일 끝에 덧붙인다.

```python
Theme = Literal["food", "cafe", "drink", "play"]
THEMES: tuple[str, ...] = ("food", "cafe", "drink", "play")
THEME_OFF = "any"
```

- [ ] **Step 2: 실패하는 테스트 작성 (themes 모듈)**

`backend/tests/pipeline/test_themes.py`:

```python
from pipeline.themes import assign_themes, fill_themes, split_list, top_groups

HUBS = [
    {"group_id": "1", "name": "가", "region": "서울", "tags": "술집많음;교통요지", "vibe_summary": "v"},
    {"group_id": "2", "name": "나", "region": "서울", "tags": "카페거리", "vibe_summary": "v"},
    {"group_id": "3", "name": "다", "region": "경기", "tags": "쇼핑", "vibe_summary": "v"},
    {"group_id": "4", "name": "라", "region": "경기", "tags": "영화관", "vibe_summary": "v"},
]
CANDIDATES = [
    {"group_id": "1", "name": "가", "region": "서울", "food": "900", "cafe": "100", "play": "10", "score": "0"},
    {"group_id": "2", "name": "나", "region": "서울", "food": "300", "cafe": "500", "play": "40", "score": "0"},
    {"group_id": "3", "name": "다", "region": "경기", "food": "200", "cafe": "50", "play": "5", "score": "0"},
    {"group_id": "9", "name": "거점아님", "region": "서울", "food": "5000", "cafe": "5000", "play": "5000", "score": "0"},
]


def test_split_list_drops_blanks():
    assert split_list("food; cafe;;") == ["food", "cafe"]
    assert split_list("") == []


def test_top_groups_ranks_only_hubs():
    # 거점이 아닌 group 9는 개수가 가장 많아도 순위에 들지 않는다
    assert top_groups(["1", "2", "3", "4"], CANDIDATES, "food", n=2) == {"1", "2"}


def test_top_groups_breaks_ties_by_group_id():
    tied = [{**CANDIDATES[0], "food": "100"}, {**CANDIDATES[1], "food": "100"}]
    assert top_groups(["1", "2"], tied, "food", n=1) == {"1"}


def test_assign_themes_combines_counts_and_tags():
    # n=1: food 1위는 group 1, cafe 1위와 play 1위는 group 2
    assert assign_themes(HUBS, CANDIDATES, n=1) == [
        ["food", "drink"],   # 음식점 1위 + 술집많음 태그
        ["cafe", "play"],    # 카페 1위(카페거리 태그도 있음) + 놀거리 1위
        [],                  # 해당 없음
        ["play"],            # 후보 파일에 없는 거점은 태그(영화관)로만
    ]


def test_fill_themes_keeps_existing_unless_forced():
    hubs = [{**HUBS[0], "themes": "cafe"}, {**HUBS[1], "themes": ""}]
    kept = fill_themes(hubs, CANDIDATES)
    assert [r["themes"] for r in kept] == ["cafe", "food;cafe;play"]
    forced = fill_themes(hubs, CANDIDATES, force=True)
    assert [r["themes"] for r in forced] == ["food;cafe;drink;play", "food;cafe;play"]
    # 다른 열은 그대로
    assert forced[0]["tags"] == "술집많음;교통요지"
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `cd backend && .venv/Scripts/pytest tests/pipeline/test_themes.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'pipeline.themes'`

- [ ] **Step 4: `pipeline/themes.py` 작성**

```python
"""hubs.csv의 themes 열 초안을 만든다. 한 번 실행하고 눈으로 검토한 뒤에는 hubs.csv가 원본이다.

실행: python -m pipeline.themes          (themes가 비어 있는 행만 채운다)
      python -m pipeline.themes --force  (전부 다시 계산한다)
"""

import sys
from collections.abc import Sequence

from app.options import THEMES
from pipeline.config import MANUAL_DIR, OUT_DIR
from pipeline.io import read_csv_rows, write_csv

HUB_FIELDS = ("group_id", "name", "region", "tags", "themes", "vibe_summary")
# 측정값이 아니라 고른 값. 근거는 data/SOURCES.md.
THEME_TOP_N = 30
# 개수 상위권으로 판정하는 테마와 hub_candidates.csv의 열 이름
COUNT_COLUMNS = {"food": "food", "cafe": "cafe", "play": "play"}
THEME_TAGS = {
    "food": frozenset({"먹자골목", "맛집", "먹거리"}),
    "cafe": frozenset({"카페거리"}),
    "play": frozenset({"방탈출많음", "영화관"}),
    "drink": frozenset({"술집많음", "밤늦게까지", "포차"}),
}


def split_list(value: str) -> list[str]:
    return [v.strip() for v in value.split(";") if v.strip()]


def top_groups(
    hub_group_ids: Sequence[str],
    candidates: Sequence[dict[str, str]],
    column: str,
    n: int = THEME_TOP_N,
) -> set[str]:
    """거점 중에서 column 값이 큰 순서로 n곳의 group_id. 후보 파일에 없는 거점은 빠진다."""
    hub_set = set(hub_group_ids)
    counted = [(int(c[column]), c["group_id"]) for c in candidates if c["group_id"] in hub_set]
    ordered = sorted(counted, key=lambda pair: (-pair[0], int(pair[1])))
    return {group_id for _, group_id in ordered[:n]}


def assign_themes(
    hubs: Sequence[dict[str, str]],
    candidates: Sequence[dict[str, str]],
    n: int = THEME_TOP_N,
) -> list[list[str]]:
    group_ids = [h["group_id"] for h in hubs]
    top = {theme: top_groups(group_ids, candidates, column, n) for theme, column in COUNT_COLUMNS.items()}
    result = []
    for h in hubs:
        tags = set(split_list(h["tags"]))
        result.append([
            theme for theme in THEMES
            if h["group_id"] in top.get(theme, set()) or tags & THEME_TAGS[theme]
        ])
    return result


def fill_themes(
    hubs: Sequence[dict[str, str]],
    candidates: Sequence[dict[str, str]],
    force: bool = False,
) -> list[dict[str, str]]:
    drafted = assign_themes(hubs, candidates)
    rows = []
    for h, themes in zip(hubs, drafted, strict=True):
        existing = h.get("themes", "")
        value = existing if existing and not force else ";".join(themes)
        rows.append({**h, "themes": value})
    return rows


def main(argv: Sequence[str]) -> None:
    hubs = read_csv_rows(MANUAL_DIR / "hubs.csv")
    candidates = read_csv_rows(OUT_DIR / "hub_candidates.csv")
    rows = fill_themes(hubs, candidates, force="--force" in argv)
    write_csv(MANUAL_DIR / "hubs.csv", HUB_FIELDS, rows)
    for theme in THEMES:
        print(f"{theme}: {sum(1 for r in rows if theme in split_list(r['themes']))}곳")
    print(f"테마 없음: {sum(1 for r in rows if not r['themes'])}곳")


if __name__ == "__main__":
    main(sys.argv[1:])
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd backend && .venv/Scripts/pytest tests/pipeline/test_themes.py -q`
Expected: 5 passed

- [ ] **Step 6: 검증 규칙 테스트 작성**

`backend/tests/pipeline/test_validate.py`의 import 목록에 `check_hub_themes`를 추가하고 파일 끝에 덧붙인다.

```python
def test_hub_themes_must_be_known_values():
    ok = [{"name": "가", "themes": "food;cafe"}, {"name": "나", "themes": ""}]
    assert check_hub_themes(ok) == []
    problems = check_hub_themes([{"name": "다", "themes": "food;study"}, {"name": "라"}])
    assert len(problems) == 2
    assert "다" in problems[0] and "study" in problems[0]
    assert "라" in problems[1]
```

Run: `cd backend && .venv/Scripts/pytest tests/pipeline/test_validate.py -q`
Expected: FAIL, `ImportError: cannot import name 'check_hub_themes'`

- [ ] **Step 7: `pipeline/validate.py`에 검증 추가**

import에 추가:

```python
from app.options import THEMES
from pipeline.themes import split_list
```

`check_hubs_have_nodes` 아래에 함수 추가:

```python
def check_hub_themes(hubs: Iterable[dict[str, str]]) -> list[str]:
    problems = []
    for h in hubs:
        if "themes" not in h:
            problems.append(f"거점에 themes 열 없음: {h['name']}")
            continue
        unknown = [t for t in split_list(h["themes"]) if t not in THEMES]
        if unknown:
            problems.append(f"거점 테마 값 오류: {h['name']} {unknown}")
    return problems
```

`run_all_checks`에서 `problems += check_hubs_have_nodes(hubs, stations)` 다음 줄에 추가:

```python
    problems += check_hub_themes(hubs)
```

Run: `cd backend && .venv/Scripts/pytest tests/pipeline/test_validate.py -q`
Expected: 전부 passed

- [ ] **Step 8: 모델과 적재, 그 테스트 수정**

`backend/app/models.py`의 `Hub`에 `tags` 아래 한 줄 추가:

```python
    themes: Mapped[list[str]] = mapped_column(JSON, default=list)
```

`backend/tests/pipeline/test_load.py`의 `_write_outputs` 안 `hubs.csv` 쓰는 부분을 바꾼다.

```python
    write_csv(manual / "hubs.csv", ["group_id", "name", "region", "tags", "themes", "vibe_summary"], [
        {"group_id": 1, "name": "홍대입구", "region": "서울", "tags": "밤늦게까지;20대", "themes": "drink;play", "vibe_summary": "밤늦게까지 북적이는 젊은 동네"},
        {"group_id": 2, "name": "강남", "region": "서울", "tags": "교통요지", "themes": "", "vibe_summary": "어디서든 오기 쉬운 교통 중심"},
    ])
```

같은 파일 `test_load_all_fills_tables_and_is_idempotent`의 `hub.tags` 단언 아래에 추가:

```python
        assert hub.themes == ["drink", "play"]
        assert s.scalar(select(Hub).where(Hub.name == "강남")).themes == []
```

`backend/tests/pipeline/test_run_all_synthetic.py`의 `hubs.csv` 쓰는 세 줄을 바꾼다.

```python
    write_csv(manual / "hubs.csv", ["group_id", "name", "region", "tags", "themes", "vibe_summary"], [
        {"group_id": group_id["가람"], "name": "가람", "region": "서울", "tags": "교통요지", "themes": "food", "vibe_summary": "합성 거점"},
        {"group_id": group_id["사랑"], "name": "사랑", "region": "서울", "tags": "환승;골목", "themes": "", "vibe_summary": "합성 환승 거점"},
    ])
```

Run: `cd backend && .venv/Scripts/pytest tests/pipeline/test_load.py -q`
Expected: FAIL, `AttributeError` 또는 `hub.themes == []` 불일치 (적재가 아직 themes를 안 넣음)

`backend/pipeline/load.py`에 `from pipeline.themes import split_list`를 추가하고 `_hub_rows`의 딕셔너리에서 `tags` 줄을 바꾸고 `themes` 줄을 추가한다. 열이 없으면 `KeyError`로 실패하는 것이 의도다.

```python
            "tags": split_list(h["tags"]),
            "themes": split_list(h["themes"]),
```

Run: `cd backend && .venv/Scripts/pytest tests/pipeline/test_load.py tests/pipeline/test_run_all_synthetic.py -q`
Expected: 전부 passed

- [ ] **Step 9: 실제 `hubs.csv`에 themes 열 채우기**

`backend/tests/pipeline/test_manual_data.py`의 `test_hubs_csv_has_100_rows_with_required_fields`를 먼저 고친다. 열 목록 단언을 바꾸고 테마 단언을 추가한다. 파일 상단에 `from app.options import THEMES`, `from pipeline.themes import split_list`를 import한다.

```python
    assert set(rows[0]) == {"group_id", "name", "region", "tags", "themes", "vibe_summary"}
```

```python
    for r in rows:
        assert set(split_list(r["themes"])) <= set(THEMES), r
    for theme in THEMES:
        assert sum(1 for r in rows if theme in split_list(r["themes"])) >= 10, theme
```

Run: `cd backend && .venv/Scripts/pytest tests/pipeline/test_manual_data.py -q`
Expected: FAIL (열 목록 불일치)

스크립트를 실행한다.

Run: `cd backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python -m pipeline.themes`
Expected: 테마별 곳 수 네 줄과 "테마 없음" 한 줄 출력. food, cafe, play는 30곳 이상, drink는 30곳 이상 40곳 이하 범위.

themes 열 말고 바뀐 것이 없는지 확인한다.

```bash
cd backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python -c "
import csv, io, subprocess
old = list(csv.DictReader(io.StringIO(subprocess.run(['git', 'show', 'HEAD:backend/data/manual/hubs.csv'], capture_output=True, encoding='utf-8').stdout)))
new = list(csv.DictReader(open('data/manual/hubs.csv', encoding='utf-8', newline='')))
assert len(old) == len(new) == 100
for o, n in zip(old, new):
    assert o == {k: v for k, v in n.items() if k != 'themes'}, (o, n)
print('themes 열만 추가됨')
"
```

Expected: `themes 열만 추가됨`

Run: `cd backend && .venv/Scripts/pytest tests/pipeline/test_manual_data.py -q && PYTHONIOENCODING=utf-8 .venv/Scripts/python -m pipeline.validate`
Expected: passed, "검증 통과"

- [ ] **Step 10: 사용자 검토**

테마별 거점 이름을 출력해 사용자에게 보여주고, 넣거나 뺄 곳이 있으면 `hubs.csv`를 직접 고친다.

```bash
cd backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python -c "
import csv
rows = list(csv.DictReader(open('data/manual/hubs.csv', encoding='utf-8', newline='')))
for theme in ('food', 'cafe', 'drink', 'play'):
    names = [r['name'] for r in rows if theme in r['themes'].split(';')]
    print(theme, len(names), ', '.join(names))
print('없음', ', '.join(r['name'] for r in rows if not r['themes']))
"
```

고친 뒤에는 Step 9의 pytest와 validate를 다시 돌린다.

- [ ] **Step 11: SOURCES.md에 근거 기록**

`backend/data/SOURCES.md` 끝에 덧붙인다.

```markdown
## 거점 테마 (2026-10)

`data/manual/hubs.csv`의 `themes` 열. 값은 `food`, `cafe`, `drink`, `play`.

- 초안은 `python -m pipeline.themes`가 만들었다. 이후에는 `hubs.csv`가 원본이고 손으로 고친다.
- food, cafe, play: `data/out/hub_candidates.csv`의 장소 개수가 거점 100곳 중 상위 30위 이내이거나 관련 태그가 있으면 해당. 태그는 food `먹자골목`, `맛집`, `먹거리`, cafe `카페거리`, play `방탈출많음`, `영화관`.
- drink: 태그 `술집많음`, `밤늦게까지`, `포차`. 술집 개수를 따로 세지 않았기 때문에 태그만 쓴다.
- 상위 30(`THEME_TOP_N`)은 측정값이 아니라 고른 값이다. 테마마다 거점의 약 3분의 1이 해당하도록 잡았다.
- 판교는 `hub_candidates.csv`에 없어서 태그로만 판정한다.
- 모르는 테마 값이 있으면 `pipeline.validate`가 실패한다.
```

- [ ] **Step 12: 전체 테스트와 커밋**

Run: `cd backend && .venv/Scripts/pytest -q`
Expected: 229 passed (223 + test_themes 5 + check_hub_themes 1)

```bash
git add backend/app/options.py backend/app/models.py backend/pipeline/themes.py backend/pipeline/validate.py backend/pipeline/load.py backend/data/manual/hubs.csv backend/data/SOURCES.md backend/tests/pipeline
git commit -m "feat: hub themes column drafted from place counts and tags"
```

---
## Task 3: 테마 우선 순위 규칙

**Files:**
- Modify: `backend/app/ranking/rank.py`
- Modify: `backend/data/SOURCES.md`
- Test: `backend/tests/test_rank.py`

**Interfaces:**
- Consumes: 기존 `_score_hub(participants, hub, matrix) -> HubScore | None`, `HubScore(hub_id, name, max_minutes, sum_minutes, spread_minutes, legs)`.
- Produces:
  - `THEME_TOLERANCE_MINUTES = 5`
  - `Ranking(best_max_minutes: int | None, scores: tuple[HubScore, ...])` (frozen dataclass)
  - `rank_with_preference(participants, hubs, matrix, top_n=5, preferred_hub_ids: frozenset[int] = frozenset(), tolerance_minutes: int = THEME_TOLERANCE_MINUTES) -> Ranking`
  - `rank_hubs(participants, hubs, matrix, top_n=5) -> list[HubScore]`는 시그니처와 동작 그대로 (내부에서 `rank_with_preference`를 부른다)

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/test_rank.py`의 import 줄을 바꾸고:

```python
from app.ranking.rank import HubCandidate, ParticipantInput, Ranking, rank_hubs, rank_with_preference
```

파일 끝에 덧붙인다.

```python
def _two_people():
    return [
        ParticipantInput(1, "a", (StationWalk(1, "A", 0, "walk"),)),
        ParticipantInput(2, "b", (StationWalk(2, "B", 0, "walk"),)),
    ]


def _theme_world():
    """거점 노드 10~13. 두 사람이 같은 시간을 쓰므로 최대 시간은 값 + 5(하차 도보): 25, 30, 31, 45."""
    transit = {10: 20, 11: 25, 12: 26, 13: 40}
    matrix = StationTimeMatrix({(p, node): m for node, m in transit.items() for p in (1, 2)})
    hubs = [HubCandidate(node, f"거점{node}", (node,)) for node in transit]
    return hubs, matrix


def _ids(ranking: Ranking) -> list[int]:
    return [s.hub_id for s in ranking.scores]


def test_no_preference_matches_plain_fairness_order():
    hubs, matrix = _theme_world()
    ranking = rank_with_preference(_two_people(), hubs, matrix)
    assert _ids(ranking) == [10, 11, 12, 13]
    assert ranking.best_max_minutes == 25
    assert [s.hub_id for s in rank_hubs(_two_people(), hubs, matrix)] == [10, 11, 12, 13]


def test_preferred_hub_exactly_five_minutes_slower_goes_first():
    hubs, matrix = _theme_world()
    ranking = rank_with_preference(_two_people(), hubs, matrix, preferred_hub_ids=frozenset({11}))
    assert _ids(ranking) == [11, 10, 12, 13]
    assert ranking.best_max_minutes == 25


def test_preferred_hub_six_minutes_slower_keeps_its_place():
    hubs, matrix = _theme_world()
    ranking = rank_with_preference(_two_people(), hubs, matrix, preferred_hub_ids=frozenset({12}))
    assert _ids(ranking) == [10, 11, 12, 13]


def test_only_preferred_hubs_within_tolerance_move_up():
    hubs, matrix = _theme_world()
    ranking = rank_with_preference(_two_people(), hubs, matrix, preferred_hub_ids=frozenset({11, 12, 13}))
    assert _ids(ranking) == [11, 10, 12, 13]


def test_best_is_reported_even_when_fastest_hub_is_cut():
    hubs, matrix = _theme_world()
    ranking = rank_with_preference(_two_people(), hubs, matrix, top_n=1, preferred_hub_ids=frozenset({11}))
    assert _ids(ranking) == [11]
    assert ranking.best_max_minutes == 25


def test_no_reachable_hub_gives_empty_ranking():
    matrix = StationTimeMatrix({(1, 10): 30})
    ranking = rank_with_preference(_two_people(), [HubCandidate(10, "b는못감", (10,))], matrix)
    assert ranking == Ranking(None, ())
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && .venv/Scripts/pytest tests/test_rank.py -q`
Expected: FAIL, `ImportError: cannot import name 'Ranking'`

- [ ] **Step 3: `rank.py` 구현**

`backend/app/ranking/rank.py`의 `rank_hubs` 함수를 지우고 그 자리에 아래를 넣는다. `HubScore` 정의 위쪽 import 아래에는 상수를 추가한다.

```python
# 테마에 맞는 거점을 앞에 둘 때 공평함을 양보하는 한도(분). 측정값이 아니라 고른 값. 근거는 data/SOURCES.md.
THEME_TOLERANCE_MINUTES = 5
```

```python
@dataclass(frozen=True)
class Ranking:
    best_max_minutes: int | None
    scores: tuple[HubScore, ...]


def rank_with_preference(
    participants: Sequence[ParticipantInput],
    hubs: Sequence[HubCandidate],
    matrix: StationTimeMatrix,
    top_n: int = 5,
    preferred_hub_ids: frozenset[int] = frozenset(),
    tolerance_minutes: int = THEME_TOLERANCE_MINUTES,
) -> Ranking:
    """공평함 순위. 선호 거점은 가장 빠른 곳보다 tolerance_minutes 이내로만 느릴 때 앞에 둔다."""
    scored = [s for h in hubs if (s := _score_hub(participants, h, matrix)) is not None]
    if not scored:
        return Ranking(None, ())
    best = min(s.max_minutes for s in scored)

    def key(s: HubScore) -> tuple[int, int, int, int]:
        preferred = s.hub_id in preferred_hub_ids and s.max_minutes <= best + tolerance_minutes
        return (0 if preferred else 1, s.max_minutes, s.sum_minutes, s.hub_id)

    return Ranking(best, tuple(sorted(scored, key=key)[:top_n]))


def rank_hubs(
    participants: Sequence[ParticipantInput],
    hubs: Sequence[HubCandidate],
    matrix: StationTimeMatrix,
    top_n: int = 5,
) -> list[HubScore]:
    return list(rank_with_preference(participants, hubs, matrix, top_n).scores)
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && .venv/Scripts/pytest tests/test_rank.py -q`
Expected: 10 passed (기존 4 + 6)

- [ ] **Step 5: SOURCES.md에 5분 근거 기록**

`backend/data/SOURCES.md`의 "거점 테마 (2026-10)" 절 끝에 덧붙인다.

```markdown
- 테마 허용 오차 5분(`app/ranking/rank.py`의 `THEME_TOLERANCE_MINUTES`)도 고른 값이다. 가장 공평한 거점보다 최대 이동시간이 5분 이내로 더 걸리는 거점만 테마에 맞을 때 앞으로 온다. 시간표가 분 단위 반올림이고 배차 대기가 빠져 있어, 5분 이내 차이는 실제 체감으로 구분하기 어렵다고 보고 정했다.
```

- [ ] **Step 6: 전체 테스트와 커밋**

Run: `cd backend && .venv/Scripts/pytest -q`
Expected: 235 passed

```bash
git add backend/app/ranking/rank.py backend/tests/test_rank.py backend/data/SOURCES.md
git commit -m "feat: theme preference within five minutes of the fairest hub"
```

---

## Task 4: 결과 응답에 테마, 노선, 최단 기준 추가

**Files:**
- Modify: `backend/app/models.py` (Room)
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/hubs.py`
- Modify: `backend/app/rooms/service.py`
- Modify: `backend/app/rooms/router.py`
- Test: `backend/tests/test_theme_api.py` (신규), `backend/tests/test_hubs.py`

**Interfaces:**
- Consumes: `rank_with_preference(...) -> Ranking` (Task 3), `Hub.themes` (Task 2), `app.options.Theme`, `THEME_OFF` (Task 2), `compute_result(..., regions=None)` (Task 1).
- Produces:
  - `Room.theme: str | None`
  - `RoomCreate.theme: Theme | None = None`, `RoomOut.theme: str | None`
  - `RecommendationOut.lines: list[str]`, `RecommendationOut.theme_match: bool`
  - `ResultOut.best_max_minutes: int | None`, `ResultOut.theme: str | None`
  - `load_hub_candidates(session, stations: Sequence[Station] | None = None)`
  - `hub_lines(hubs: Sequence[Hub], stations: Sequence[Station]) -> dict[int, list[str]]`
  - `compute_result(session, room, matrix, regions=None, theme: str | None = None) -> ResultOut`
  - `GET /rooms/{slug}/result?theme=cafe` (`any`는 테마 끔)

- [ ] **Step 1: `hub_lines` 실패 테스트 작성**

`backend/tests/test_hubs.py`의 첫 import 줄을 `from app.hubs import hub_lines, hub_node_ids, load_hub_candidates`로 바꾸고 파일 끝에 덧붙인다.

```python
def test_hub_lines_are_sorted_distinct_lines_of_the_hub_group(seeded):
    from app.stations import all_stations

    seeded.add(Station(id=7, name="강남", line="신분당선", lat=37.4979, lng=127.0276, group_id=2))
    seeded.add(Station(id=8, name="강남", line="2호선", lat=37.4979, lng=127.0276, group_id=2))
    seeded.commit()
    stations = all_stations(seeded)
    hubs, candidates = load_hub_candidates(seeded, stations)
    lines = hub_lines(hubs, stations)
    assert lines[2] == ["2호선", "신분당선"]
    assert lines[1] == ["2호선"]
    assert set(next(c for c in candidates if c.name == "강남").node_ids) == {2, 7, 8}
```

Run: `cd backend && .venv/Scripts/pytest tests/test_hubs.py -q`
Expected: FAIL, `ImportError: cannot import name 'hub_lines'`

- [ ] **Step 2: `app/hubs.py` 수정**

파일 전체를 다음으로 바꾼다.

```python
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Hub, Station
from app.ranking.rank import HubCandidate
from app.stations import all_stations


def load_hub_candidates(
    session: Session, stations: Sequence[Station] | None = None
) -> tuple[list[Hub], list[HubCandidate]]:
    """거점과 같은 그룹(물리적으로 같은 역)에 속한 역 노드 id 묶음. stations를 주면 다시 읽지 않는다."""
    hubs = list(session.scalars(select(Hub).order_by(Hub.id)).all())
    nodes_by_group: dict[int, list[int]] = {}
    for s in stations if stations is not None else all_stations(session):
        nodes_by_group.setdefault(s.group_id, []).append(s.id)
    candidates = [
        HubCandidate(h.id, h.name, tuple(nodes_by_group.get(h.group_id, ()))) for h in hubs
    ]
    return hubs, candidates


def hub_lines(hubs: Sequence[Hub], stations: Sequence[Station]) -> dict[int, list[str]]:
    """거점 id별 노선 이름. 같은 그룹에 속한 역 노드의 노선을 중복 없이 정렬한다."""
    lines_by_group: dict[int, set[str]] = {}
    for s in stations:
        lines_by_group.setdefault(s.group_id, set()).add(s.line)
    return {h.id: sorted(lines_by_group.get(h.group_id, set())) for h in hubs}


def hub_node_ids(session: Session) -> set[int]:
    _, candidates = load_hub_candidates(session)
    return {node for c in candidates for node in c.node_ids}
```

Run: `cd backend && .venv/Scripts/pytest tests/test_hubs.py -q`
Expected: 전부 passed

- [ ] **Step 3: API 실패 테스트 작성**

`backend/tests/test_theme_api.py`:

```python
import pytest
from fastapi.testclient import TestClient

from app.db import get_db
from app.deps import get_geocoder, get_matrix
from app.main import create_app
from app.models import Hub, Station
from app.transit.matrix import StationTimeMatrix


class NoGeocoder:
    def geocode(self, query: str):
        return None


@pytest.fixture
def client(seeded):
    seeded.get(Hub, 1).themes = ["food", "cafe"]   # 홍대입구
    seeded.get(Hub, 2).themes = ["cafe"]           # 강남
    seeded.get(Hub, 4).themes = ["food"]           # 건대입구
    seeded.add(Station(id=7, name="강남", line="신분당선", lat=37.4979, lng=127.0276, group_id=2))
    seeded.commit()
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: NoGeocoder()
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    return TestClient(app)


def _room(client, **extra):
    response = client.post("/rooms", json={"title": "테마 모임", "meet_date": "2026-10-10", **extra})
    assert response.status_code == 201, response.text
    return response.json()


def _join_gangnam_and_kondae(client, slug):
    for nickname, station_id in (("강남사람", 2), ("건대사람", 4)):
        response = client.post(f"/rooms/{slug}/participants", json={"nickname": nickname, "station_id": station_id})
        assert response.status_code == 201, response.text


def _names(body):
    return [r["name"] for r in body["recommendations"]]


def test_room_stores_theme_and_defaults_to_none(client):
    assert _room(client)["theme"] is None
    assert _room(client, theme="cafe")["theme"] == "cafe"


def test_room_rejects_unknown_theme(client):
    response = client.post("/rooms", json={"title": "t", "meet_date": "2026-10-10", "theme": "study"})
    assert response.status_code == 422


def test_no_theme_keeps_fairness_order(client):
    slug = _room(client)["slug"]
    _join_gangnam_and_kondae(client, slug)
    body = client.get(f"/rooms/{slug}/result").json()
    # 최대 시간: 잠실 20, 강남 25, 건대입구 25, 홍대입구 40
    assert _names(body) == ["잠실", "강남", "건대입구", "홍대입구"]
    assert body["best_max_minutes"] == 20
    assert body["theme"] is None
    assert [r["theme_match"] for r in body["recommendations"]] == [False, False, False, False]


def test_theme_moves_matching_hub_within_five_minutes_first(client):
    slug = _room(client, theme="food")["slug"]
    _join_gangnam_and_kondae(client, slug)
    body = client.get(f"/rooms/{slug}/result").json()
    # 건대입구(25분)는 가장 빠른 잠실(20분)보다 5분 느려 앞으로 온다. 홍대입구(40분)는 맞는 테마여도 제자리.
    assert _names(body) == ["건대입구", "잠실", "강남", "홍대입구"]
    assert body["best_max_minutes"] == 20
    assert body["theme"] == "food"
    assert {r["name"]: r["theme_match"] for r in body["recommendations"]} == {
        "건대입구": True, "잠실": False, "강남": False, "홍대입구": True,
    }


def test_query_theme_overrides_room_theme_and_any_turns_it_off(client):
    slug = _room(client, theme="food")["slug"]
    _join_gangnam_and_kondae(client, slug)
    cafe = client.get(f"/rooms/{slug}/result", params={"theme": "cafe"}).json()
    assert _names(cafe) == ["강남", "잠실", "건대입구", "홍대입구"]
    assert cafe["theme"] == "cafe"
    off = client.get(f"/rooms/{slug}/result", params={"theme": "any"}).json()
    assert _names(off) == ["잠실", "강남", "건대입구", "홍대입구"]
    assert off["theme"] is None


def test_unknown_theme_query_is_422(client):
    slug = _room(client)["slug"]
    assert client.get(f"/rooms/{slug}/result", params={"theme": "study"}).status_code == 422


def test_recommendations_carry_hub_lines(client):
    slug = _room(client)["slug"]
    _join_gangnam_and_kondae(client, slug)
    body = client.get(f"/rooms/{slug}/result").json()
    lines = {r["name"]: r["lines"] for r in body["recommendations"]}
    assert lines["강남"] == ["2호선", "신분당선"]
    assert lines["잠실"] == ["2호선"]


def test_waiting_result_has_no_best(client):
    slug = _room(client, theme="play")["slug"]
    body = client.get(f"/rooms/{slug}/result").json()
    assert body["status"] == "waiting"
    assert body["best_max_minutes"] is None
    assert body["theme"] == "play"
```

Run: `cd backend && .venv/Scripts/pytest tests/test_theme_api.py -q`
Expected: 전부 FAIL (`theme` 키 없음, 422 대신 201 등)

- [ ] **Step 4: 모델과 스키마 수정**

`backend/app/models.py`의 `Room`에 `regions` 아래 한 줄 추가:

```python
    theme: Mapped[str | None] = mapped_column(String(10), nullable=True, default=None)
```

`backend/app/schemas.py`의 options import를 `from app.options import REGIONS, Region, Theme`으로 바꾸고 다음을 반영한다.

`RoomCreate`에 `regions` 아래:

```python
    theme: Theme | None = None
```

`RoomOut`에 `regions` 아래:

```python
    theme: str | None
```

`RecommendationOut`에 `spread_minutes` 아래:

```python
    lines: list[str]
    theme_match: bool
```

`ResultOut` 전체:

```python
class ResultOut(BaseModel):
    status: Literal["waiting", "ready"]
    recommendations: list[RecommendationOut]
    best_max_minutes: int | None
    regions: list[str]
    theme: str | None
```

- [ ] **Step 5: 서비스 수정**

`backend/app/rooms/service.py`의 import를 고친다.

```python
from app.hubs import hub_lines, load_hub_candidates
from app.models import Hub, Participant, Room, Station
from app.options import REGIONS, THEME_OFF
from app.ranking.rank import HubScore, ParticipantInput, rank_with_preference
```

(`rank_hubs` import는 더 쓰지 않으므로 지운다.)

`create_room`의 `Room(...)`에 `theme=data.theme,`를, `room_out`의 `RoomOut(...)`에 `theme=room.theme,`를 추가한다.

`compute_result`를 지우고 그 자리에 아래 세 함수를 넣는다.

```python
def _applied_theme(room: Room, theme: str | None) -> str | None:
    chosen = theme if theme is not None else room.theme
    return None if chosen in (None, THEME_OFF) else chosen


def _recommendation(score: HubScore, hub: Hub, lines: list[str], theme_match: bool) -> RecommendationOut:
    return RecommendationOut(
        hub_id=score.hub_id,
        name=score.name,
        region=hub.region,
        tags=list(hub.tags),
        vibe_summary=hub.vibe_summary,
        lat=hub.lat,
        lng=hub.lng,
        max_minutes=score.max_minutes,
        spread_minutes=score.spread_minutes,
        lines=lines,
        theme_match=theme_match,
        legs=[
            LegOut(
                participant_id=l.participant_id,
                nickname=l.nickname,
                minutes=l.leg.total_minutes,
                origin_station_name=l.leg.origin_station_name,
                via=l.leg.via,
            )
            for l in score.legs
        ],
    )


def compute_result(
    session: Session,
    room: Room,
    matrix: StationTimeMatrix,
    regions: Sequence[str] | None = None,
    theme: str | None = None,
) -> ResultOut:
    applied_regions = [r for r in REGIONS if r in (regions or room.regions)]
    applied_theme = _applied_theme(room, theme)
    if len(room.participants) < 2:
        return ResultOut(
            status="waiting", recommendations=[], best_max_minutes=None,
            regions=applied_regions, theme=applied_theme,
        )
    inputs = [
        ParticipantInput(p.id, p.nickname, tuple(StationWalk(**d) for d in p.nearest_stations))
        for p in room.participants
    ]
    stations = all_stations(session)
    hubs, candidates = load_hub_candidates(session, stations)
    hub_by_id = {h.id: h for h in hubs}
    # 상위 5곳을 자르기 전에 지역으로 거른다. 자른 뒤 거르면 결과가 비어 보인다.
    in_region = [c for c in candidates if hub_by_id[c.hub_id].region in applied_regions]
    matching = frozenset(
        c.hub_id for c in in_region
        if applied_theme is not None and applied_theme in hub_by_id[c.hub_id].themes
    )
    ranking = rank_with_preference(inputs, in_region, matrix, preferred_hub_ids=matching)
    lines = hub_lines(hubs, stations)
    return ResultOut(
        status="ready",
        recommendations=[
            _recommendation(s, hub_by_id[s.hub_id], lines[s.hub_id], s.hub_id in matching)
            for s in ranking.scores
        ],
        best_max_minutes=ranking.best_max_minutes,
        regions=applied_regions,
        theme=applied_theme,
    )
```

- [ ] **Step 6: 라우터 수정**

`backend/app/rooms/router.py`의 options import를 `from app.options import Region, Theme`으로 바꾸고 `get_result`를 바꾼다.

```python
@router.get("/rooms/{slug}/result", response_model=ResultOut)
def get_result(
    slug: str,
    region: list[Region] | None = Query(default=None),
    theme: Theme | Literal["any"] | None = Query(default=None),
    db: Session = Depends(get_db),
    matrix: StationTimeMatrix = Depends(get_matrix),
) -> ResultOut:
    room = service.get_room(db, slug)
    return service.compute_result(db, room, matrix, regions=region, theme=theme)
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd backend && .venv/Scripts/pytest tests/test_theme_api.py tests/test_hubs.py tests/test_regions_api.py tests/test_rooms_api.py -q`
Expected: 전부 passed

Run: `cd backend && .venv/Scripts/pytest -q`
Expected: 244 passed (235 + 9)

- [ ] **Step 8: 커밋**

```bash
git add backend/app backend/tests/test_theme_api.py backend/tests/test_hubs.py
git commit -m "feat: room theme, hub lines and fastest baseline in result response"
```

---

## Task 5: 주소 검색 프록시

**Files:**
- Modify: `backend/app/places/kakao_local.py`
- Create: `backend/app/places/suggest.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/rooms/router.py`
- Test: `backend/tests/test_place_search_api.py`

**Interfaces:**
- Consumes: `KakaoLocalClient._get(path, params) -> list[dict]`, `app.deps.get_local_client`, `app.geo.METRO_LAT_RANGE = (36.9, 38.3)`, `app.geo.METRO_LNG_RANGE = (126.3, 127.9)`, 라우터의 `MSG_CONTENT_UNAVAILABLE = "지금 불러올 수 없어요"`.
- Produces:
  - `KakaoLocalClient.suggest(query: str, rect: str, size: int = 5) -> list[dict]`
  - `app.places.suggest.suggest_places(client, query) -> list[PlaceSuggestion]`, `PlaceSuggestion(name: str, address: str)`
  - `PlaceSearchIn{q: str}` (공백 제거 후 2~30자), `PlaceSuggestOut{name, address}`, `PlaceSearchOut{items: list[PlaceSuggestOut], error: str | None}`
  - `POST /places/search` 본문 `{"q": "..."}`. 검색어를 URL에 넣지 않는다 (접근 로그에 남지 않게).

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/test_place_search_api.py`:

```python
import logging

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.db import get_db
from app.deps import get_local_client
from app.main import create_app
from app.places.kakao_local import KakaoLocalClient

KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
DOCS = {
    "documents": [
        {"place_name": "스타벅스 강남역점", "road_address_name": "서울 강남구 강남대로 390", "address_name": "서울 강남구 역삼동 825"},
        {"place_name": "강남구청", "road_address_name": "", "address_name": "서울 강남구 삼성동 16-1"},
        {"place_name": "주소없는곳", "road_address_name": "", "address_name": ""},
    ]
}


@pytest.fixture
def client(seeded):
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_local_client] = lambda: KakaoLocalClient("k")
    return TestClient(app)


@respx.mock
def test_search_returns_name_and_address_inside_metro(client):
    route = respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json=DOCS))
    response = client.post("/places/search", json={"q": "  강남역 스타벅스 "})
    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {"name": "스타벅스 강남역점", "address": "서울 강남구 강남대로 390"},   # 도로명 주소 우선
            {"name": "강남구청", "address": "서울 강남구 삼성동 16-1"},             # 없으면 지번
        ],
        "error": None,
    }
    params = route.calls.last.request.url.params
    assert params["query"] == "강남역 스타벅스"
    assert params["rect"] == "126.3,36.9,127.9,38.3"
    assert params["size"] == "5"
    assert "x" not in params and "radius" not in params


@respx.mock
def test_upstream_failure_returns_empty_items_with_message_and_does_not_log_query(client, caplog):
    respx.get(KEYWORD_URL).mock(return_value=httpx.Response(500))
    with caplog.at_level(logging.WARNING):
        response = client.post("/places/search", json={"q": "우리집 주소"})
    assert response.status_code == 200
    assert response.json() == {"items": [], "error": "지금 불러올 수 없어요"}
    assert "우리집" not in caplog.text


def test_query_must_have_two_to_thirty_characters(client):
    for bad in ("a", "   ", "가" * 31):
        assert client.post("/places/search", json={"q": bad}).status_code == 422, bad
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && .venv/Scripts/pytest tests/test_place_search_api.py -q`
Expected: FAIL, 404 또는 405 (경로 없음)

- [ ] **Step 3: 클라이언트 메서드 추가**

`backend/app/places/kakao_local.py`의 `keyword_search` 아래에 추가:

```python
    def suggest(self, query: str, rect: str, size: int = 5) -> list[dict]:
        """중심 좌표 없이 키워드로 찾는다. rect는 "왼쪽 경도,아래 위도,오른쪽 경도,위 위도"."""
        return self._get("keyword.json", {"query": query, "rect": rect, "size": size})
```

- [ ] **Step 4: `app/places/suggest.py` 작성**

```python
from dataclasses import dataclass

from app.geo import METRO_LAT_RANGE, METRO_LNG_RANGE
from app.places.kakao_local import KakaoLocalClient

SUGGEST_LIMIT = 5
# 수도권 밖 결과는 어차피 참여가 거절되므로 검색 단계에서 뺀다
METRO_RECT = f"{METRO_LNG_RANGE[0]},{METRO_LAT_RANGE[0]},{METRO_LNG_RANGE[1]},{METRO_LAT_RANGE[1]}"


@dataclass(frozen=True)
class PlaceSuggestion:
    name: str
    address: str


def suggest_places(client: KakaoLocalClient, query: str) -> list[PlaceSuggestion]:
    docs = client.suggest(query, METRO_RECT, size=SUGGEST_LIMIT)
    found = [
        PlaceSuggestion(
            name=d.get("place_name", ""),
            address=d.get("road_address_name") or d.get("address_name") or "",
        )
        for d in docs
    ]
    return [s for s in found if s.name and s.address]
```

- [ ] **Step 5: 스키마와 라우터 추가**

`backend/app/schemas.py` 끝에 덧붙인다.

```python
class PlaceSearchIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    q: str = Field(min_length=2, max_length=30)


class PlaceSuggestOut(BaseModel):
    name: str
    address: str


class PlaceSearchOut(BaseModel):
    items: list[PlaceSuggestOut]
    error: str | None
```

`backend/app/rooms/router.py`의 schemas import 목록에 `PlaceSearchIn`, `PlaceSearchOut`, `PlaceSuggestOut`을 추가하고, `from app.places.suggest import suggest_places`를 import한다. `stations` 엔드포인트 아래, `MSG_CONTENT_UNAVAILABLE` 정의 **뒤**에 엔드포인트를 넣는다 (상수를 쓰기 때문).

```python
@router.post("/places/search", response_model=PlaceSearchOut)
def place_search(
    data: PlaceSearchIn,
    local_client: KakaoLocalClient = Depends(get_local_client),
) -> PlaceSearchOut:
    try:
        found = suggest_places(local_client, data.q)
    except httpx.HTTPError as exc:
        # 검색어는 집 주소일 수 있어 남기지 않는다. 예외 클래스 이름만 기록한다.
        logger.warning("place search failed error=%s", type(exc).__name__)
        return PlaceSearchOut(items=[], error=MSG_CONTENT_UNAVAILABLE)
    return PlaceSearchOut(
        items=[PlaceSuggestOut(name=s.name, address=s.address) for s in found], error=None
    )
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd backend && .venv/Scripts/pytest tests/test_place_search_api.py -q`
Expected: 3 passed

Run: `cd backend && .venv/Scripts/pytest -q`
Expected: 247 passed

- [ ] **Step 7: 커밋**

```bash
git add backend/app/places backend/app/schemas.py backend/app/rooms/router.py backend/tests/test_place_search_api.py
git commit -m "feat: place search proxy for origin autocomplete"
```

---

## Task 6: 참가자 빼기와 다시 넣기

**Files:**
- Modify: `backend/app/models.py` (Participant)
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/rooms/service.py`
- Modify: `backend/app/rooms/router.py`
- Test: `backend/tests/test_participant_active_api.py`

**Interfaces:**
- Consumes: `service.get_room(db, slug)`, `compute_result` (Task 4).
- Produces:
  - `Participant.active: bool` (기본 참)
  - `ParticipantOut.active: bool`, `ParticipantUpdate{active: bool}`
  - `service.MSG_PARTICIPANT_NOT_FOUND = "참여자를 찾을 수 없어요"`
  - `service.set_participant_active(session, room, participant_id: int, active: bool) -> Participant`
  - `PATCH /rooms/{slug}/participants/{participant_id}` 본문 `{"active": bool}`, 응답 `ParticipantOut`
  - `compute_result`는 `active`인 참가자만 계산에 쓴다. 정원 20명 검사는 그대로 전체 행 수.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/test_participant_active_api.py`:

```python
import pytest
from fastapi.testclient import TestClient

from app.db import get_db
from app.deps import get_geocoder, get_matrix
from app.main import create_app
from app.transit.matrix import StationTimeMatrix


class NoGeocoder:
    def geocode(self, query: str):
        return None


@pytest.fixture
def client(seeded):
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: NoGeocoder()
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    return TestClient(app)


def _slug(client) -> str:
    return client.post("/rooms", json={"title": "모임", "meet_date": "2026-10-10"}).json()["slug"]


def _join(client, slug, nickname, station_id) -> dict:
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": nickname, "station_id": station_id})
    assert response.status_code == 201, response.text
    return response.json()


def _set_active(client, slug, participant_id, active):
    return client.patch(f"/rooms/{slug}/participants/{participant_id}", json={"active": active})


def test_new_participant_is_active(client):
    slug = _slug(client)
    assert _join(client, slug, "홍대", 1)["active"] is True
    assert client.get(f"/rooms/{slug}").json()["participants"][0]["active"] is True


def test_removed_participant_stays_listed_as_inactive(client):
    slug = _slug(client)
    p = _join(client, slug, "홍대", 1)
    response = _set_active(client, slug, p["id"], False)
    assert response.status_code == 200
    assert response.json()["active"] is False
    listed = client.get(f"/rooms/{slug}").json()["participants"]
    assert [(x["nickname"], x["active"]) for x in listed] == [("홍대", False)]


def test_result_ignores_inactive_and_waits_below_two(client):
    slug = _slug(client)
    a = _join(client, slug, "홍대", 1)
    b = _join(client, slug, "수원", 6)
    _join(client, slug, "잠실", 3)
    full = client.get(f"/rooms/{slug}/result").json()
    assert len(full["recommendations"][0]["legs"]) == 3

    _set_active(client, slug, b["id"], False)
    two = client.get(f"/rooms/{slug}/result").json()
    assert two["status"] == "ready"
    assert {l["nickname"] for l in two["recommendations"][0]["legs"]} == {"홍대", "잠실"}

    _set_active(client, slug, a["id"], False)
    one = client.get(f"/rooms/{slug}/result").json()
    assert one["status"] == "waiting"
    assert one["recommendations"] == []


def test_readding_restores_participant_in_result(client):
    slug = _slug(client)
    a = _join(client, slug, "홍대", 1)
    _join(client, slug, "잠실", 3)
    _set_active(client, slug, a["id"], False)
    assert client.get(f"/rooms/{slug}/result").json()["status"] == "waiting"
    assert _set_active(client, slug, a["id"], True).json()["active"] is True
    assert client.get(f"/rooms/{slug}/result").json()["status"] == "ready"


def test_participant_of_another_room_is_404(client):
    mine, other = _slug(client), _slug(client)
    stranger = _join(client, other, "남의방", 1)
    response = _set_active(client, mine, stranger["id"], False)
    assert response.status_code == 404
    assert response.json()["detail"] == "참여자를 찾을 수 없어요"
    assert client.get(f"/rooms/{other}").json()["participants"][0]["active"] is True


def test_unknown_participant_is_404(client):
    slug = _slug(client)
    assert _set_active(client, slug, 99999, False).status_code == 404


def test_inactive_participants_still_count_toward_capacity(client):
    slug = _slug(client)
    first = _join(client, slug, "참여자0", 1)
    for i in range(1, 20):
        _join(client, slug, f"참여자{i}", 1)
    _set_active(client, slug, first["id"], False)
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "늦둥이", "station_id": 1})
    assert response.status_code == 422
    assert response.json()["detail"] == "참여 인원이 가득 찼어요 (최대 20명)"
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && .venv/Scripts/pytest tests/test_participant_active_api.py -q`
Expected: 전부 FAIL (`KeyError: 'active'`, PATCH는 405)

- [ ] **Step 3: 모델과 스키마 수정**

`backend/app/models.py`의 sqlalchemy import에 `Boolean`을 추가하고 `Participant`에 `nearest_stations` 아래 한 줄 추가:

```python
    active: Mapped[bool] = mapped_column(Boolean, default=True)
```

`backend/app/schemas.py`의 `ParticipantOut`에 `via` 아래 `active: bool`을 추가하고, `ParticipantOut` 아래에 클래스를 추가한다.

```python
class ParticipantUpdate(BaseModel):
    active: bool
```

- [ ] **Step 4: 서비스 수정**

`backend/app/rooms/service.py`의 `MSG_ROOM_FULL` 아래에 추가:

```python
MSG_PARTICIPANT_NOT_FOUND = "참여자를 찾을 수 없어요"
```

`add_participant`의 `Participant(...)` 생성에 `active=True,`를 추가한다. 정원 검사 줄(`len(room.participants) >= MAX_PARTICIPANTS`)은 그대로 두고 주석만 바꾼다.

```python
    # 지오코딩 전에 막는다. 정원은 빠진 사람을 포함한 전체 행 수로 센다 (빼기를 반복해 행이 늘지 않게).
```

`add_participant` 아래에 함수를 추가한다.

```python
def set_participant_active(session: Session, room: Room, participant_id: int, active: bool) -> Participant:
    participant = session.get(Participant, participant_id)
    if participant is None or participant.room_id != room.id:
        raise HTTPException(status_code=404, detail=MSG_PARTICIPANT_NOT_FOUND)
    participant.active = active
    session.commit()
    session.refresh(participant)
    session.refresh(room)
    return participant
```

`participant_out`의 `ParticipantOut(...)`에 `active=p.active`를 추가한다.

```python
    return ParticipantOut(
        id=p.id, nickname=p.nickname, nearest_station_name=first["station_name"],
        via=first["via"], active=p.active,
    )
```

`compute_result`에서 참가자를 쓰는 두 군데를 바꾼다. 함수 첫머리 `applied_theme = ...` 다음 줄에 추가하고:

```python
    present = [p for p in room.participants if p.active]
```

`if len(room.participants) < 2:`를 `if len(present) < 2:`로, `inputs` 리스트의 `for p in room.participants`를 `for p in present`로 바꾼다.

- [ ] **Step 5: 라우터 추가**

`backend/app/rooms/router.py`의 schemas import에 `ParticipantUpdate`를 추가하고 `add_participant` 엔드포인트 아래에 넣는다.

```python
@router.patch("/rooms/{slug}/participants/{participant_id}", response_model=ParticipantOut)
def update_participant(
    slug: str,
    participant_id: int,
    data: ParticipantUpdate,
    db: Session = Depends(get_db),
) -> ParticipantOut:
    room = service.get_room(db, slug)
    return service.participant_out(
        service.set_participant_active(db, room, participant_id, data.active)
    )
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd backend && .venv/Scripts/pytest tests/test_participant_active_api.py -q`
Expected: 7 passed

Run: `cd backend && .venv/Scripts/pytest -q`
Expected: 254 passed

- [ ] **Step 7: 커밋**

```bash
git add backend/app backend/tests/test_participant_active_api.py
git commit -m "feat: set participants inactive and back without deleting them"
```

---

## Task 7: 백엔드 문서 갱신, DB 재생성, 실데이터 확인

**Files:**
- Modify: `docs/design.md` (상태 줄, 2, 3, 4, 5, 6, 8절)
- Modify: `backend/README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Task 1~6의 전부.
- Produces: 새 스키마로 적재된 로컬 `backend/dev.db`. 프론트 태스크(Task 8 이후)가 이 DB로 띄운 서버를 쓴다.

- [ ] **Step 1: `docs/design.md` 갱신**

상태 줄을 바꾼다.

```markdown
상태: 백엔드와 데이터 구현 완료, 프론트엔드 구현 중 (`docs/frontend-design.md`)
```

2절 표 끝에 세 줄을 추가한다.

```markdown
| 만남 지역 | 방 만들 때 서울, 경기, 인천 복수 선택(기본 전부). 추천 화면 필터는 보는 사람 화면에서만 바뀜 | 멀리 가기 싫은 모임이 지역을 제한할 수 있게 |
| 테마 | 맛집, 카페, 술자리, 놀거리 중 하나(선택). 가장 공평한 곳보다 5분 이내로 더 걸리는 거점 중 테마에 맞는 곳을 앞에 둠 | 공평함은 5분까지만 양보하고 모임 성격을 반영 |
| 참가자 빼기 | 링크를 가진 누구나 빼고 다시 넣을 수 있음. 삭제가 아니라 계산 제외 | 못 오는 사람이 생겨도 방을 새로 만들지 않게. 되돌릴 수 있어야 실수에 안전 |
```

3절 "사용자 흐름"의 번호 목록 4개를 아래 5개로 바꾼다.

```markdown
1. **방 만들기**: 모임 이름, 약속 날짜, 만남 지역(서울, 경기, 인천 복수), 테마(선택)를 입력. 짧은 코드 링크 생성 (예: `/r/k3x9pq`).
2. **참여**: 링크를 열면 닉네임과 출발지 입력. 출발지는 지하철역 선택 또는 주소 검색. 한 브라우저에서 여러 명을 대신 넣을 수 있고, 못 오는 사람은 누구나 빼거나 다시 넣을 수 있다. 로그인 없음.
3. **추천**: 참여자 2명 이상이면 추천 5곳 표시 (1단계는 10초 폴링). 지역과 테마는 각자 화면에서 바꿔볼 수 있다. 카드에 사람별 소요시간과 공평도.
4. **둘러보기**: 거점을 고르면 그 동네의 맛집, 카페, 놀거리, 행사.
5. **만료**: 약속 날짜 7일 뒤 방과 참여자 데이터 자동 삭제.
```

4절 구성 요소 표의 frontend 줄을 바꾼다.

```markdown
| frontend | 화면 4개 (만들기, 참여, 추천, 둘러보기) + 카카오맵 | Vercel |
```

5절 표에서 세 줄을 바꾼다.

```markdown
| rooms | id, slug, title, meet_date, regions, theme, created_at, expires_at | expires_at = meet_date + 7일. regions는 서울, 경기, 인천 중 1개 이상. theme은 없을 수 있음 |
| participants | id, room_id, nickname, lat, lng, nearest_stations, active, created_at | lat/lng 반올림. nearest_stations는 역 id와 도보분 최대 3개 (JSON). active가 거짓이면 계산에서 제외 |
| hubs | station_id, name, lat, lng, region, tags, themes, vibe_summary | 큐레이션 100곳. region은 서울/경기/인천. themes는 food, cafe, drink, play |
```

6절 "추천 알고리즘"의 번호 목록을 아래로 바꾼다.

```markdown
1. 후보: 방(또는 요청)의 지역에 속한 거점만. 계산에는 빠지지 않은 참여자만 쓴다.
2. 참여자 p의 거점 h까지 소요시간:
   `time(p, h) = min over s in p.nearest_stations ( walk(p, s) + station_times[s][h] ) + 5분(거점역 하차 후 도보)`
3. 거점 점수: `score(h) = max over p ( time(p, h) )`. 작을수록 좋음.
4. 동점이면 `sum over p ( time(p, h) )`가 작은 쪽 우선.
5. 테마가 있으면, 가장 작은 점수보다 5분 이내로 큰 거점 중 테마에 맞는 곳을 앞에 둔다. 그 뒤는 3, 4번 순서 그대로. 5분은 측정값이 아니라 고른 값이다 (`backend/data/SOURCES.md`).
6. 상위 5곳 반환.
7. 화면 표시: "가장 오래 걸리는 사람 약 32분, 차이 9분" 형태로 공평도 함께 표시. 테마 때문에 앞에 온 거점에는 "가장 빠른 곳보다 N분 더"를 붙인다.
```

8절 표 끝에 줄을 추가한다.

```markdown
| 그 방의 참가자가 아닌 id로 빼기 요청 | "참여자를 찾을 수 없어요" |
| 주소 검색 실패 | 빈 목록과 "지금 불러올 수 없어요". 역 선택은 계속 가능 |
| 고른 지역에 추천할 거점이 없음 | "이 지역엔 추천할 곳이 없어요. 지역을 넓혀보세요." (프론트 문구) |
| 전체 지역인데 추천이 비어 있음 | "경로를 계산하지 못했어요. 방을 새로 만들어 다시 시도해주세요." (프론트 문구) |
| 열어둔 거점이 추천에서 사라짐 | "추천이 바뀌었어요" 안내 후 추천 화면으로 (프론트 문구) |
| 주변 장소 0건 | "근처에서 찾지 못했어요" (프론트 문구) |
| 입력 검증 실패 (422 목록 응답) | "입력을 다시 확인해주세요" (프론트 문구) |
| 서버에 닿지 못함 | "연결이 불안정해요. 잠시 후 다시 시도해주세요." (프론트 문구) |
```

- [ ] **Step 2: `backend/README.md`와 `CLAUDE.md` 갱신**

`backend/README.md`의 "이 버전은 `stations`와 `hubs`에 ..." 문단을 아래로 바꾼다.

```markdown
스키마가 바뀌면 `scripts.init_db`는 기존 테이블에 컬럼을 추가하지 않는다. 가장 최근 변경(2026-10)은 `rooms.regions`, `rooms.theme`, `participants.active`, `hubs.themes`다. 이전 버전으로 만든 DB는 모든 테이블을 지우고 `init_db`를 다시 실행한 뒤 적재한다. 로컬은 `dev.db` 파일을 지우면 된다. 방과 참여자 데이터도 함께 사라진다.
```

"거점 목록은 `data/manual/hubs.csv`에서 읽는다" 문단 뒤에 한 줄 추가:

```markdown
`hubs.csv`의 `themes` 열 초안은 `python -m pipeline.themes`가 만든다 (비어 있는 행만 채움, `--force`는 전부 다시 계산). 평소에는 손으로 고친다.
```

`CLAUDE.md`의 "핵심 데이터 개념" 목록 끝에 두 줄 추가:

```markdown
- 방은 `regions`(서울, 경기, 인천 중 1개 이상)와 `theme`(없을 수 있음)을 가진다. 결과 API의 `region`, `theme` 쿼리가 방 기본값보다 우선한다. 지역 필터는 반드시 `rank_with_preference` 전에 건다.
- 참가자는 지우지 않고 `active`를 끈다. 계산은 `active`만, 정원 20명은 전체 행 수.
```

- [ ] **Step 3: 로컬 DB 재생성**

서버가 떠 있으면 먼저 끈다.

```bash
cd backend && rm -f dev.db && .venv/Scripts/python -m scripts.init_db && PYTHONIOENCODING=utf-8 .venv/Scripts/python -m pipeline.load
```

Expected: `tables created`, 이어서 `station_groups: 646`, `stations: 791`, `hubs: 100`, `station_times: 124978`

- [ ] **Step 4: 실데이터 확인**

서버를 띄운다 (`.claude/launch.json`의 `backend` 설정, 포트 8000). 그다음:

```bash
cd backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python -c "
import httpx
c = httpx.Client(base_url='http://localhost:8000')
def sid(name):
    return c.get('/stations', params={'q': name}).json()[0]['id']
slug = c.post('/rooms', json={'title': '확인', 'meet_date': '2026-12-31'}).json()['slug']
ids = {}
for n in ('홍대입구', '수원', '잠실'):
    r = c.post(f'/rooms/{slug}/participants', json={'nickname': n, 'station_id': sid(n)})
    r.raise_for_status()
    ids[n] = r.json()['id']
for params in ({}, {'region': '서울'}, {'theme': 'cafe'}, {'theme': 'drink'}):
    body = c.get(f'/rooms/{slug}/result', params=params).json()
    print(params, 'best', body['best_max_minutes'])
    for r in body['recommendations']:
        print('  ', r['name'], r['max_minutes'], r['region'], r['lines'], r['theme_match'])
print(c.patch(f'/rooms/{slug}/participants/{ids[\"수원\"]}', json={'active': False}).json())
print(c.get(f'/rooms/{slug}/result').json()['recommendations'][0]['name'])
print(c.post('/places/search', json={'q': '강남역'}).json())
"
```

Expected:
- 필터 없음: 2호선 홍대입구 노드로 계산하면 1위 판교, 최대 약 44분 (공항철도 홍대입구 노드를 고르면 1위 서현 43분, 판교는 2위. 출발 노드에 따라 달라지는 것이지 결함이 아니다)
- `region=서울`: 어느 홍대입구 노드를 골라도 1위 가락시장, 최대 약 54분. 모든 줄의 지역이 서울
- `theme=cafe`, `theme=drink`: `best`는 필터 없음과 같고, 1위는 `best + 5` 이내이면서 `theme_match`가 참인 거점 (없으면 순서가 필터 없음과 같다)
- 수원을 뺀 뒤 1위가 바뀜 (홍대입구와 잠실 사이 거점)
- 주소 검색: 카카오 키가 `.env`에 있으면 `items`에 결과, 없으면 `error` 문구

2호선 홍대입구 기준으로 판교와 가락시장이 다르게 나오면 멈추고 원인을 찾는다 (지역 필터가 순위 계산 뒤에 걸렸거나 적재가 덜 된 경우).

- [ ] **Step 5: 전체 테스트와 커밋**

Run: `cd backend && .venv/Scripts/pytest -q`
Expected: 254 passed

```bash
git add docs/design.md backend/README.md CLAUDE.md
git commit -m "docs: regions, themes and participant removal in product design"
```

---
# B. 프론트엔드

프론트 태스크는 백엔드 서버(포트 8000, Task 7에서 재생성한 `dev.db`)가 떠 있다고 가정한다. 화면을 눈으로 확인하는 단계는 `.claude/launch.json`의 `backend`, `frontend` 설정으로 띄운다.

## Task 8: 프론트 뼈대

**Files:**
- Create: `frontend/` (create-next-app 생성물)
- Create: `frontend/vitest.config.ts`, `frontend/vitest.setup.ts`, `frontend/lib/test/server.ts`, `frontend/lib/test/server.test.ts`
- Create: `frontend/scripts/gen-api.mjs`, `frontend/lib/api/schema.d.ts` (생성물)
- Create: `frontend/.env.example`
- Modify: `frontend/app/globals.css`, `frontend/app/layout.tsx`, `frontend/app/page.tsx`, `frontend/package.json`, `frontend/.gitignore`
- Modify: `.claude/launch.json`, `.gitignore`

**Interfaces:**
- Consumes: 백엔드 `app.main:app`의 OpenAPI (Task 1~6 반영).
- Produces:
  - npm 스크립트: `dev`, `build`, `lint`, `test`(`vitest run`), `coverage`, `gen:api`
  - `lib/api/schema.d.ts`의 `components["schemas"]` (RoomOut, RoomCreate, ParticipantOut, ParticipantCreate, ParticipantUpdate, ResultOut, RecommendationOut, LegOut, StationOut, PlaceSearchIn, PlaceSearchOut, PlaceSuggestOut, ContentOut)
  - `lib/test/server.ts`의 `server` (MSW `setupServer()`), 가로채지 않은 요청은 테스트 실패
  - Tailwind 색 유틸리티: `bg-paper`, `bg-card`, `border-line`, `bg-primary`, `text-primary`, `bg-primary-soft`, `bg-primary-tint`, `bg-accent`, `text-accent`, `text-ink`, `text-ink-sub`, `text-ink-mute`, `bg-track`, 모서리 `rounded-card`

- [ ] **Step 1: 프로젝트 생성**

저장소 루트에서 실행한다.

```bash
npx create-next-app@16 frontend --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --disable-git --yes
```

Expected: `frontend/` 생성, `Success! Created frontend`. 질문이 뜨면 기본값을 고른다.

- [ ] **Step 2: 의존성 설치**

```bash
cd frontend && npm install @tanstack/react-query lucide-react pretendard react-kakao-maps-sdk
```

```bash
cd frontend && npm install -D vitest @vitest/coverage-v8 @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom "msw@^2" openapi-typescript @playwright/test kakao.maps.d.ts
```

글꼴 파일 위치를 확인한다.

Run: `cd frontend && ls node_modules/pretendard/dist/web/variable/woff2/`
Expected: `PretendardVariable.woff2`가 보인다. 경로가 다르면 Step 5의 `src`를 실제 경로로 맞춘다.

- [ ] **Step 3: 테스트 도구 설정**

`frontend/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["{lib,components}/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["lib/**", "components/**"],
      exclude: ["lib/api/schema.d.ts", "lib/api/types.ts", "lib/test/**", "**/*.test.*"],
      thresholds: { lines: 80 },
    },
  },
});
```

`frontend/lib/test/server.ts`:

```ts
import { setupServer } from "msw/node";

// 테스트마다 server.use(...)로 핸들러를 넣는다. 가로채지 않은 요청은 테스트를 실패시킨다.
export const server = setupServer();
```

`frontend/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./lib/test/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  window.localStorage.clear();
});
afterAll(() => server.close());
```

`frontend/lib/test/server.test.ts` (도구가 맞물려 도는지 확인하는 테스트):

```ts
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { server } from "./server";

test("MSW가 fetch를 가로챈다", async () => {
  server.use(http.get("http://localhost:8000/health", () => HttpResponse.json({ ok: true })));
  const response = await fetch("http://localhost:8000/health");
  expect(await response.json()).toEqual({ ok: true });
});
```

`frontend/package.json`의 `scripts`에 추가한다 (기존 `dev`, `build`, `start`, `lint`는 그대로).

```json
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "gen:api": "node scripts/gen-api.mjs",
    "e2e": "playwright test"
```

Run: `cd frontend && npm test`
Expected: 1 passed

- [ ] **Step 4: 디자인 토큰**

`frontend/app/globals.css` 전체를 바꾼다.

```css
@import "tailwindcss";

@theme {
  --color-paper: #fcf9f5;
  --color-card: #ffffff;
  --color-line: #e5e2de;
  --color-primary: #0f5238;
  --color-primary-soft: #2d6a4f;
  --color-primary-tint: #b1f0ce;
  --color-accent: #b22a1d;
  --color-ink: #1c1c1a;
  --color-ink-sub: #404943;
  --color-ink-mute: #707973;
  --color-track: #f0edea;
  --radius-card: 16px;
  --font-sans: var(--font-pretendard), system-ui, sans-serif;
}

body {
  background: var(--color-paper);
  color: var(--color-ink);
}
```

- [ ] **Step 5: 레이아웃과 임시 첫 화면**

`frontend/app/layout.tsx` 전체를 바꾼다.

```tsx
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: "우리지금만나",
  description: "각자 출발지를 넣으면 가장 공평한 만남 장소를 찾아줘요",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="font-sans antialiased">
        <div className="mx-auto min-h-dvh max-w-[480px] px-4 pb-32 pt-4">{children}</div>
      </body>
    </html>
  );
}
```

`frontend/app/page.tsx` 전체를 바꾼다 (Task 12에서 실제 화면으로 교체).

```tsx
export default function HomePage() {
  return (
    <main className="space-y-3">
      <h1 className="text-xl font-extrabold text-primary">우리지금만나</h1>
      <p className="rounded-card border border-line bg-card p-4 text-ink-sub">모두에게 공평한 만남 장소</p>
      <span className="inline-block -rotate-3 rounded bg-accent px-2 py-0.5 text-xs font-bold text-white">1위</span>
    </main>
  );
}
```

create-next-app이 만든 `frontend/public/*.svg`와 `frontend/app/page.module.css`(있으면)는 지운다.

- [ ] **Step 6: API 타입 생성 스크립트**

`frontend/scripts/gen-api.mjs`:

```js
// 백엔드를 띄우지 않고 OpenAPI를 뽑아 TS 타입을 만든다. 백엔드 스키마를 고치면 다시 실행한다.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.resolve(root, "../backend");
const isWindows = process.platform === "win32";
const python = path.join(backend, ".venv", isWindows ? "Scripts/python.exe" : "bin/python");

const spec = execFileSync(
  python,
  ["-c", "import json; from app.main import app; print(json.dumps(app.openapi()))"],
  { cwd: backend, encoding: "utf-8" },
);
writeFileSync(path.join(root, "openapi.json"), spec);
execFileSync("npx openapi-typescript openapi.json -o lib/api/schema.d.ts", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
```

Run: `cd frontend && npm run gen:api`
Expected: `lib/api/schema.d.ts` 생성

Run: `cd frontend && grep -c "best_max_minutes\|theme_match\|PlaceSearchOut\|ParticipantUpdate" lib/api/schema.d.ts`
Expected: 4 이상

- [ ] **Step 7: 환경 변수와 무시 목록**

`frontend/.env.example`:

```
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_KAKAO_JS_KEY=
```

```bash
cd frontend && cp .env.example .env.local
```

`frontend/.gitignore` 끝에 덧붙인다 (create-next-app의 `.env*` 규칙이 예시 파일까지 무시하기 때문).

```
!.env.example
openapi.json
coverage/
test-results/
playwright-report/
```

- [ ] **Step 8: 실행 설정**

`.claude/launch.json`의 `configurations` 배열에 추가한다.

```json
    {
      "name": "frontend",
      "runtimeExecutable": "cmd.exe",
      "runtimeArgs": ["/c", "cd /d frontend && npm run dev"],
      "port": 3000
    }
```

- [ ] **Step 9: 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공, 경로 `/`가 목록에 보인다

Run: `cd frontend && npm run lint`
Expected: 에러 없음

`frontend` 설정으로 개발 서버를 띄우고 http://localhost:3000 을 연다.
Expected: 종이색 배경, 진녹색 제목, 둥근 흰 카드, 살짝 기울어진 빨간 "1위" 도장. 글꼴이 Pretendard로 보인다.

- [ ] **Step 10: 커밋**

```bash
git add frontend .claude/launch.json
git commit -m "feat: frontend scaffold with design tokens, test tooling and generated api types"
```

---

## Task 9: 순수 함수 모듈 (`lib/`)

**Files:**
- Create: `frontend/lib/constants.ts`, `messages.ts`, `regions.ts`, `themes.ts`, `lines.ts`, `format.ts`, `filter.ts`, `share.ts`, `myParticipants.ts`, `useDebounced.ts`
- Test: `frontend/lib/regions.test.ts`, `themes.test.ts`, `lines.test.ts`, `format.test.ts`, `filter.test.ts`, `myParticipants.test.ts`, `useDebounced.test.ts`

**Interfaces:**
- Consumes: 없음.
- Produces (전부 named export):
  - `constants.ts`: `SERVICE_NAME`, `MAX_PARTICIPANTS = 20`, `POLL_MS = 10_000`, `SEARCH_DEBOUNCE_MS = 300`, `WALK_METERS_PER_MINUTE = 67`
  - `regions.ts`: `REGIONS`, `type Region`, `parseRegions(values) -> Region[]`, `isAllRegions(values) -> boolean`, `toggleRegion(current, region) -> Region[]`
  - `themes.ts`: `type ThemeId`, `type ContentKind`, `THEME_OFF = "any"`, `THEMES`, `CONTENT_TABS`, `isThemeId`, `themeLabel(value) -> string | null`, `parseTheme(value) -> ThemeId | "any" | null`, `firstTab(theme) -> ContentKind`
  - `lines.ts`: `lineStyle(line) -> { background: string; color: string }`, `shortLine(line) -> string`
  - `format.ts`: `aboutMinutes(n)`, `walkMinutes(distanceM)`, `average(values)`, `todayIso(now?)`, `formatMeetDate(iso)`, `dday(iso, now?)`
  - `filter.ts`: `type ResultFilter = { regions: readonly Region[] | null; theme: string | null }`, `NO_FILTER`, `filterFromSearch(search: URLSearchParams) -> ResultFilter`, `filterQuery(filter) -> string` (`""` 또는 `"?region=...&theme=..."`)
  - `share.ts`: `copyText(text) -> Promise<boolean>`, `roomUrl(slug, origin?) -> string`
  - `myParticipants.ts`: `readMine(slug) -> number[]`, `addMine(slug, id) -> number[]`
  - `useDebounced.ts`: `useDebounced<T>(value: T, ms?: number) -> T`
  - `messages.ts`: 아래 Step 3의 상수 전부

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/lib/regions.test.ts`:

```ts
import { expect, test } from "vitest";
import { isAllRegions, parseRegions, toggleRegion } from "./regions";

test("parseRegions는 모르는 값을 버리고 순서를 서울, 경기, 인천으로 맞춘다", () => {
  expect(parseRegions(["인천", "부산", "서울", "서울"])).toEqual(["서울", "인천"]);
  expect(parseRegions([])).toEqual([]);
});

test("isAllRegions는 셋 다 있을 때만 참", () => {
  expect(isAllRegions(["서울", "경기", "인천"])).toBe(true);
  expect(isAllRegions(["서울", "경기"])).toBe(false);
});

test("toggleRegion은 켜고 끄되 마지막 하나는 끄지 않는다", () => {
  expect(toggleRegion(["서울", "경기"], "경기")).toEqual(["서울"]);
  expect(toggleRegion(["서울"], "인천")).toEqual(["서울", "인천"]);
  expect(toggleRegion(["서울"], "서울")).toEqual(["서울"]);
});
```

`frontend/lib/themes.test.ts`:

```ts
import { expect, test } from "vitest";
import { CONTENT_TABS, firstTab, parseTheme, themeLabel, THEMES } from "./themes";

test("테마는 네 가지, 탭은 네 가지", () => {
  expect(THEMES.map((t) => t.id)).toEqual(["food", "cafe", "drink", "play"]);
  expect(CONTENT_TABS.map((t) => t.kind)).toEqual(["food", "cafe", "play", "event"]);
});

test("themeLabel은 한글 이름을, 모르는 값과 없음에는 null을 준다", () => {
  expect(themeLabel("drink")).toBe("술자리");
  expect(themeLabel("study")).toBeNull();
  expect(themeLabel(null)).toBeNull();
});

test("parseTheme은 테마 id와 any만 통과시킨다", () => {
  expect(parseTheme("cafe")).toBe("cafe");
  expect(parseTheme("any")).toBe("any");
  expect(parseTheme("study")).toBeNull();
  expect(parseTheme(null)).toBeNull();
});

test("firstTab: 술자리는 맛집 탭, 테마가 없으면 맛집 탭", () => {
  expect(firstTab("cafe")).toBe("cafe");
  expect(firstTab("play")).toBe("play");
  expect(firstTab("drink")).toBe("food");
  expect(firstTab(null)).toBe("food");
});
```

`frontend/lib/lines.test.ts`:

```ts
import { expect, test } from "vitest";
import { lineStyle, shortLine } from "./lines";

test("알려진 노선은 노선 색, 모르는 노선은 회색", () => {
  expect(lineStyle("2호선").background).toBe("#00a84d");
  expect(lineStyle("없는선").background).toBe("#8a8f8c");
});

test("밝은 노선 색에는 어두운 글자", () => {
  expect(lineStyle("수인분당선").color).toBe("#1c1c1a");
  expect(lineStyle("2호선").color).toBe("#ffffff");
});

test("shortLine은 숫자 노선만 줄인다", () => {
  expect(shortLine("2호선")).toBe("2");
  expect(shortLine("인천1호선")).toBe("인천1");
  expect(shortLine("신분당선")).toBe("신분당선");
});
```

`frontend/lib/format.test.ts`:

```ts
import { expect, test } from "vitest";
import { aboutMinutes, average, dday, formatMeetDate, todayIso, walkMinutes } from "./format";

test("aboutMinutes", () => {
  expect(aboutMinutes(45)).toBe("약 45분");
});

test("walkMinutes는 분당 67m로 올림하고 최소 1분", () => {
  expect(walkMinutes(210)).toBe(4);
  expect(walkMinutes(67)).toBe(1);
  expect(walkMinutes(68)).toBe(2);
  expect(walkMinutes(0)).toBe(1);
});

test("average는 반올림하고 빈 목록은 0", () => {
  expect(average([12, 16, 22])).toBe(17);
  expect(average([])).toBe(0);
});

test("todayIso는 현지 날짜", () => {
  expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
});

test("formatMeetDate", () => {
  expect(formatMeetDate("2026-10-10")).toBe("10월 10일 (토)");
});

test("dday", () => {
  expect(dday("2026-10-10", new Date(2026, 9, 6, 23, 30))).toBe("D-4");
  expect(dday("2026-10-10", new Date(2026, 9, 10, 8, 0))).toBe("D-DAY");
  expect(dday("2026-10-10", new Date(2026, 9, 12, 8, 0))).toBe("D+2");
});
```

`frontend/lib/filter.test.ts`:

```ts
import { expect, test } from "vitest";
import { filterFromSearch, filterQuery, NO_FILTER } from "./filter";

test("필터가 없으면 빈 문자열", () => {
  expect(filterQuery(NO_FILTER)).toBe("");
});

test("filterQuery와 filterFromSearch는 서로 되돌린다", () => {
  const filter = { regions: ["서울", "경기"] as const, theme: "cafe" };
  const query = filterQuery(filter);
  expect(query.startsWith("?region=")).toBe(true);
  expect(filterFromSearch(new URLSearchParams(query.slice(1)))).toEqual({ regions: ["서울", "경기"], theme: "cafe" });
});

test("모르는 지역과 테마는 버린다", () => {
  const filter = filterFromSearch(new URLSearchParams("region=부산&theme=study"));
  expect(filter).toEqual({ regions: null, theme: null });
});

test("any는 테마 끔으로 유지된다", () => {
  expect(filterFromSearch(new URLSearchParams("theme=any")).theme).toBe("any");
  expect(filterQuery({ regions: null, theme: "any" })).toBe("?theme=any");
});
```

`frontend/lib/myParticipants.test.ts`:

```ts
import { expect, test } from "vitest";
import { addMine, readMine } from "./myParticipants";

test("처음에는 비어 있다", () => {
  expect(readMine("abc123")).toEqual([]);
});

test("addMine은 중복 없이 쌓고 방마다 따로 저장한다", () => {
  expect(addMine("abc123", 7)).toEqual([7]);
  expect(addMine("abc123", 9)).toEqual([7, 9]);
  expect(addMine("abc123", 7)).toEqual([7, 9]);
  expect(readMine("zzz999")).toEqual([]);
  expect(window.localStorage.getItem("wjm:room:abc123:mine")).toBe("[7,9]");
});

test("깨진 저장값은 빈 목록으로 본다", () => {
  window.localStorage.setItem("wjm:room:abc123:mine", "{not json");
  expect(readMine("abc123")).toEqual([]);
  window.localStorage.setItem("wjm:room:abc123:mine", JSON.stringify(["a", 3, null]));
  expect(readMine("abc123")).toEqual([3]);
});
```

`frontend/lib/useDebounced.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useDebounced } from "./useDebounced";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("마지막 값만 지연 후 반영한다", () => {
  const { result, rerender } = renderHook(({ value }) => useDebounced(value, 300), {
    initialProps: { value: "강" },
  });
  rerender({ value: "강남" });
  rerender({ value: "강남역" });
  expect(result.current).toBe("강");
  act(() => vi.advanceTimersByTime(299));
  expect(result.current).toBe("강");
  act(() => vi.advanceTimersByTime(1));
  expect(result.current).toBe("강남역");
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd frontend && npm test`
Expected: 7개 파일이 모듈을 찾지 못해 FAIL (`Failed to resolve import "./regions"` 등)

- [ ] **Step 3: 구현**

`frontend/lib/constants.ts`:

```ts
export const SERVICE_NAME = "우리지금만나";
export const MAX_PARTICIPANTS = 20;
export const POLL_MS = 10_000;
export const SEARCH_DEBOUNCE_MS = 300;
// 도보 환산 속도. 측정값이 아니라 고른 값 (시속 4km).
export const WALK_METERS_PER_MINUTE = 67;
```

`frontend/lib/messages.ts`:

```ts
// 프론트에서만 쓰는 문구. 백엔드가 주는 문구(detail)는 그대로 보여주므로 여기 없다.
// 바꾸면 docs/design.md 8절도 함께 고친다.
export const MSG_NETWORK = "연결이 불안정해요. 잠시 후 다시 시도해주세요.";
export const MSG_INVALID_INPUT = "입력을 다시 확인해주세요";
export const MSG_TITLE_REQUIRED = "모임 이름을 적어주세요";
export const MSG_DATE_REQUIRED = "오늘 이후 날짜를 골라주세요";
export const MSG_NICKNAME_REQUIRED = "닉네임을 적어주세요";
export const MSG_ORIGIN_REQUIRED = "출발지를 골라주세요";
export const MSG_PRIVACY = "원래 주소는 저장하지 않아요. 약 100m 단위로 뭉갠 위치만 약속 7일 뒤까지 보관해요.";
export const MSG_AUTO_DELETE = "약속 7일 뒤 자동 삭제";
export const MSG_NEED_TWO = "친구를 초대하세요. 두 명부터 추천이 나와요.";
export const MSG_EMPTY_ROSTER = "아직 아무도 없어요. 첫 번째로 출발지를 넣어보세요.";
export const MSG_NO_SEARCH_RESULT = "찾지 못했어요. 다른 이름으로 검색해보세요.";
export const MSG_ROOM_FULL = "참여 인원이 가득 찼어요 (최대 20명)";
export const MSG_BUS = "버스 15분 포함";
export const MSG_NO_HUB_IN_REGION = "이 지역엔 추천할 곳이 없어요. 지역을 넓혀보세요.";
export const MSG_NO_ROUTE = "경로를 계산하지 못했어요. 방을 새로 만들어 다시 시도해주세요.";
export const MSG_LEGS_MISSING = "이동시간을 불러오지 못했어요";
export const MSG_THEME_MATCH = "테마에 맞아요";
export const MSG_HUB_GONE = "추천이 바뀌었어요";
export const MSG_NOTHING_NEARBY = "근처에서 찾지 못했어요";
export const MSG_CONTENT_UNAVAILABLE = "지금 불러올 수 없어요";
export const MSG_LINK_COPIED = "링크를 복사했어요";
export const MSG_LINK_COPY_FAILED = "복사하지 못했어요. 주소창의 링크를 직접 복사해주세요.";
export const MSG_ROOM_CREATED = "방을 만들었어요. 링크를 복사했어요";
export const MSG_ROOM_CREATED_NO_COPY = "방을 만들었어요";
export const MSG_LOADING = "불러오는 중이에요";

export function msgConfirmRemove(nickname: string): string {
  return `${nickname}님을 계산에서 뺄까요? 다시 넣을 수 있어요`;
}

export function msgSlowerThanBest(minutes: number): string {
  return `가장 빠른 곳보다 ${minutes}분 더`;
}
```

`frontend/lib/regions.ts`:

```ts
export const REGIONS = ["서울", "경기", "인천"] as const;
export type Region = (typeof REGIONS)[number];

export function parseRegions(values: readonly string[]): Region[] {
  return REGIONS.filter((region) => values.includes(region));
}

export function isAllRegions(values: readonly string[]): boolean {
  return REGIONS.every((region) => values.includes(region));
}

// 마지막 하나는 끄지 않는다. 지역이 하나도 없으면 추천할 곳이 없기 때문.
export function toggleRegion(current: readonly string[], region: Region): Region[] {
  const next = current.includes(region)
    ? parseRegions(current.filter((r) => r !== region))
    : parseRegions([...current, region]);
  return next.length > 0 ? next : parseRegions(current);
}
```

`frontend/lib/themes.ts`:

```ts
export type ContentKind = "food" | "cafe" | "play" | "event";
export type ThemeId = "food" | "cafe" | "drink" | "play";
export const THEME_OFF = "any";

type ThemeInfo = { id: ThemeId; label: string; hint: string; tab: ContentKind };

// tab은 주변 화면에서 먼저 여는 탭. 술자리는 술집을 따로 모으지 않아 맛집 탭을 연다.
export const THEMES: readonly ThemeInfo[] = [
  { id: "food", label: "맛집", hint: "밥이 중요한 모임", tab: "food" },
  { id: "cafe", label: "카페", hint: "수다 떨기 좋은 곳", tab: "cafe" },
  { id: "drink", label: "술자리", hint: "한잔하기 좋은 곳", tab: "food" },
  { id: "play", label: "놀거리", hint: "방탈출, 보드게임", tab: "play" },
];

export const CONTENT_TABS: readonly { kind: ContentKind; label: string }[] = [
  { kind: "food", label: "맛집" },
  { kind: "cafe", label: "카페" },
  { kind: "play", label: "놀거리" },
  { kind: "event", label: "행사" },
];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function themeLabel(value: string | null | undefined): string | null {
  return THEMES.find((theme) => theme.id === value)?.label ?? null;
}

export function parseTheme(value: string | null): ThemeId | typeof THEME_OFF | null {
  if (value === THEME_OFF) return THEME_OFF;
  return isThemeId(value) ? value : null;
}

export function firstTab(theme: string | null | undefined): ContentKind {
  return THEMES.find((t) => t.id === theme)?.tab ?? "food";
}
```

`frontend/lib/lines.ts` (노선 이름은 백엔드 `stations.line` 값 24종 그대로):

```ts
// 색 hex를 직접 쓰는 유일한 파일. 운영사의 노선 색이다.
const LIGHT = new Set(["수인분당선", "의정부경전철", "우이신설선", "9호선", "경의중앙선", "인천1호선"]);

const LINE_COLORS: Record<string, string> = {
  "1호선": "#0052a4",
  "2호선": "#00a84d",
  "3호선": "#ef7c1c",
  "4호선": "#00a5de",
  "5호선": "#996cac",
  "6호선": "#cd7c2f",
  "7호선": "#747f00",
  "8호선": "#e6186c",
  "9호선": "#bdb092",
  수인분당선: "#fabe00",
  경의중앙선: "#77c4a3",
  인천1호선: "#7ca8d5",
  인천2호선: "#ed8b00",
  경춘선: "#0c8e72",
  서해선: "#81a914",
  신분당선: "#d4003b",
  용인에버라인: "#509f22",
  의정부경전철: "#fda600",
  공항철도: "#0090d2",
  우이신설선: "#b0ce18",
  경강선: "#003da5",
  신림선: "#6789ca",
  김포골드라인: "#a17800",
  "GTX-A": "#9a6292",
};
const UNKNOWN_COLOR = "#8a8f8c";

export function lineStyle(line: string): { background: string; color: string } {
  return {
    background: LINE_COLORS[line] ?? UNKNOWN_COLOR,
    color: LIGHT.has(line) ? "#1c1c1a" : "#ffffff",
  };
}

export function shortLine(line: string): string {
  const seoul = /^(\d)호선$/.exec(line);
  if (seoul) return seoul[1];
  const incheon = /^인천(\d)호선$/.exec(line);
  if (incheon) return `인천${incheon[1]}`;
  return line;
}
```

`frontend/lib/format.ts`:

```ts
import { WALK_METERS_PER_MINUTE } from "./constants";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const DAY_MS = 86_400_000;

export function aboutMinutes(minutes: number): string {
  return `약 ${minutes}분`;
}

export function walkMinutes(distanceM: number): number {
  return Math.max(1, Math.ceil(distanceM / WALK_METERS_PER_MINUTE));
}

export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatMeetDate(iso: string): string {
  const date = parseIsoDate(iso);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
}

export function dday(iso: string, now: Date = new Date()): string {
  const diff = Math.round((parseIsoDate(iso).getTime() - parseIsoDate(todayIso(now)).getTime()) / DAY_MS);
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}
```

`frontend/lib/filter.ts`:

```ts
import { parseRegions, type Region } from "./regions";
import { parseTheme } from "./themes";

// URL에 적힌 필터. null은 "방의 기본값을 따른다"는 뜻이다.
export type ResultFilter = { regions: readonly Region[] | null; theme: string | null };
export const NO_FILTER: ResultFilter = { regions: null, theme: null };

export function filterFromSearch(search: URLSearchParams): ResultFilter {
  const regions = parseRegions(search.getAll("region"));
  return { regions: regions.length > 0 ? regions : null, theme: parseTheme(search.get("theme")) };
}

export function filterQuery(filter: ResultFilter): string {
  const params = new URLSearchParams();
  for (const region of filter.regions ?? []) params.append("region", region);
  if (filter.theme) params.set("theme", filter.theme);
  const query = params.toString();
  return query ? `?${query}` : "";
}
```

`frontend/lib/share.ts`:

```ts
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 권한이 없거나 http 환경. 호출한 쪽이 "직접 복사" 안내를 띄운다.
    return false;
  }
}

export function roomUrl(slug: string, origin: string = window.location.origin): string {
  return `${origin}/r/${slug}`;
}
```

`frontend/lib/myParticipants.ts`:

```ts
// 이 브라우저에서 등록한 participant id만 기억한다. hub_id와 station_id는 재적재 때 바뀌므로 저장하지 않는다.
function key(slug: string): string {
  return `wjm:room:${slug}:mine`;
}

export function readMine(slug: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key(slug)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is number => Number.isInteger(v)) : [];
  } catch {
    // 저장값이 깨졌거나 저장소를 못 쓰는 브라우저. "내가 등록" 표시만 빠진다.
    return [];
  }
}

export function addMine(slug: string, id: number): number[] {
  const next = [...new Set([...readMine(slug), id])];
  try {
    window.localStorage.setItem(key(slug), JSON.stringify(next));
  } catch {
    // 저장 실패는 표시가 빠질 뿐이라 화면을 막지 않는다.
  }
  return next;
}
```

`frontend/lib/useDebounced.ts`:

```ts
import { useEffect, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "./constants";

export function useDebounced<T>(value: T, ms: number = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npm test`
Expected: 8개 파일 전부 passed

- [ ] **Step 5: 커밋**

```bash
git add frontend/lib
git commit -m "feat: frontend pure helpers for regions, themes, lines, dates and filters"
```

---

## Task 10: API 클라이언트와 훅

**Files:**
- Create: `frontend/lib/api/client.ts`, `frontend/lib/api/types.ts`, `frontend/lib/api/hooks.ts`
- Create: `frontend/app/providers.tsx`
- Create: `frontend/lib/test/fixtures.ts`, `frontend/lib/test/render.tsx`
- Modify: `frontend/app/layout.tsx`
- Test: `frontend/lib/api/client.test.ts`, `frontend/lib/api/hooks.test.tsx`

**Interfaces:**
- Consumes: `lib/api/schema.d.ts` (Task 8), `lib/filter.ts`의 `ResultFilter`, `filterQuery` (Task 9), `lib/messages.ts`, `lib/constants.ts`.
- Produces:
  - `client.ts`: `API_BASE`, `class ApiError extends Error { status: number }`, `request<T>(path, init?) -> Promise<T>`
  - `types.ts`: `RoomOut`, `RoomCreate`, `ParticipantOut`, `ParticipantCreate`, `ResultOut`, `RecommendationOut`, `LegOut`, `StationOut`, `PlaceSearchOut`, `PlaceSuggestOut`, `ContentOut`, `Place`, `EventItem`
  - `hooks.ts`: `shouldRetry`, `resultPath(slug, filter)`, `useRoom(slug)`, `useResult(slug, filter, options?: { poll?: boolean })`, `useCreateRoom()`, `useAddParticipant(slug)`, `useSetParticipantActive(slug)`, `useStationSearch(q)`, `usePlaceSearch(q)`, `useHubContent(slug, hubId, kind)`
  - `app/providers.tsx`: `Providers`
  - `lib/test/fixtures.ts`: `API`, `participant()`, `room()`, `leg()`, `rec()`, `result()` (각각 `Partial` 덮어쓰기 인자)
  - `lib/test/render.tsx`: `renderWithClient(ui)`, `clientWrapper()`

- [ ] **Step 1: 타입 별칭과 테스트 도우미 작성**

`frontend/lib/api/types.ts`:

```ts
import type { components } from "./schema";

type Schemas = components["schemas"];

export type RoomOut = Schemas["RoomOut"];
export type RoomCreate = Schemas["RoomCreate"];
export type ParticipantOut = Schemas["ParticipantOut"];
export type ParticipantCreate = Schemas["ParticipantCreate"];
export type ResultOut = Schemas["ResultOut"];
export type RecommendationOut = Schemas["RecommendationOut"];
export type LegOut = Schemas["LegOut"];
export type StationOut = Schemas["StationOut"];
export type PlaceSearchOut = Schemas["PlaceSearchOut"];
export type PlaceSuggestOut = Schemas["PlaceSuggestOut"];
export type ContentOut = Schemas["ContentOut"];

// 백엔드 ContentOut.items는 dict 목록이라 스키마에 모양이 없다. 실제 모양은 app/places/service.py의 Place,
// app/events/service.py의 Event 데이터클래스다. 그쪽을 바꾸면 여기도 바꾼다.
export type Place = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance_m: number;
  url: string;
  lat: number;
  lng: number;
};

export type EventItem = {
  id: string;
  title: string;
  place: string;
  start_date: string;
  end_date: string;
  lat: number;
  lng: number;
  url: string;
  image: string;
  category: string;
  is_free: boolean;
  distance_m: number;
};
```

`frontend/lib/test/fixtures.ts`:

```ts
import type { LegOut, ParticipantOut, RecommendationOut, ResultOut, RoomOut } from "@/lib/api/types";

export const API = "http://localhost:8000";

export function participant(over: Partial<ParticipantOut> = {}): ParticipantOut {
  return { id: 1, nickname: "민수", nearest_station_name: "강남", via: "walk", active: true, ...over };
}

export function room(over: Partial<RoomOut> = {}): RoomOut {
  return {
    slug: "abc123",
    title: "금요일 저녁",
    meet_date: "2026-10-10",
    expires_at: "2026-10-17T00:00:00",
    regions: ["서울", "경기", "인천"],
    theme: null,
    participants: [],
    ...over,
  };
}

export function leg(over: Partial<LegOut> = {}): LegOut {
  return { participant_id: 1, nickname: "민수", minutes: 12, origin_station_name: "강남", via: "walk", ...over };
}

export function rec(over: Partial<RecommendationOut> = {}): RecommendationOut {
  return {
    hub_id: 1,
    name: "양재",
    region: "서울",
    tags: ["교통요지", "카페거리"],
    vibe_summary: "어디서든 오기 쉬운 교통 중심",
    lat: 37.4846,
    lng: 127.0343,
    max_minutes: 22,
    spread_minutes: 10,
    lines: ["3호선", "신분당선"],
    theme_match: false,
    legs: [leg(), leg({ participant_id: 2, nickname: "수진", minutes: 22, origin_station_name: "신림" })],
    ...over,
  };
}

export function result(over: Partial<ResultOut> = {}): ResultOut {
  return {
    status: "ready",
    recommendations: [rec()],
    best_max_minutes: 22,
    regions: ["서울", "경기", "인천"],
    theme: null,
    ...over,
  };
}
```

`frontend/lib/test/render.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

export function clientWrapper() {
  const client = freshClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

export function renderWithClient(ui: ReactElement) {
  return render(ui, { wrapper: clientWrapper() });
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`frontend/lib/api/client.test.ts`:

```ts
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { API } from "@/lib/test/fixtures";
import { server } from "@/lib/test/server";
import { ApiError, request } from "./client";

async function failure(path: string): Promise<ApiError> {
  try {
    await request(path);
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("실패해야 하는 요청이 성공했다");
}

test("성공하면 본문을 돌려준다", async () => {
  server.use(http.get(`${API}/health`, () => HttpResponse.json({ ok: true })));
  expect(await request<{ ok: boolean }>("/health")).toEqual({ ok: true });
});

test("detail이 문자열이면 그 문구를 그대로 쓴다", async () => {
  server.use(http.get(`${API}/rooms/x`, () => HttpResponse.json({ detail: "약속이 지난 방이에요" }, { status: 410 })));
  const error = await failure("/rooms/x");
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(410);
  expect(error.message).toBe("약속이 지난 방이에요");
});

test("detail이 목록이면 입력 확인 문구", async () => {
  server.use(http.post(`${API}/rooms`, () => HttpResponse.json({ detail: [{ msg: "field required" }] }, { status: 422 })));
  await expect(request("/rooms", { method: "POST", body: "{}" })).rejects.toMatchObject({
    status: 422,
    message: "입력을 다시 확인해주세요",
  });
});

test("서버에 닿지 못하면 연결 문구와 status 0", async () => {
  server.use(http.get(`${API}/down`, () => HttpResponse.error()));
  const error = await failure("/down");
  expect(error.status).toBe(0);
  expect(error.message).toBe("연결이 불안정해요. 잠시 후 다시 시도해주세요.");
});

test("본문이 JSON이 아니면 연결 문구", async () => {
  server.use(http.get(`${API}/broken`, () => new HttpResponse("oops", { status: 502 })));
  const error = await failure("/broken");
  expect(error.status).toBe(502);
  expect(error.message).toBe("연결이 불안정해요. 잠시 후 다시 시도해주세요.");
});
```

`frontend/lib/api/hooks.test.tsx`:

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { API, participant, result, room } from "@/lib/test/fixtures";
import { clientWrapper } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { ApiError } from "./client";
import {
  resultPath,
  shouldRetry,
  useAddParticipant,
  usePlaceSearch,
  useResult,
  useRoom,
  useSetParticipantActive,
  useStationSearch,
} from "./hooks";

test("resultPath는 필터를 쿼리로 붙인다", () => {
  expect(resultPath("abc123", { regions: null, theme: null })).toBe("/rooms/abc123/result");
  expect(resultPath("abc123", { regions: ["서울"], theme: "cafe" })).toBe(
    "/rooms/abc123/result?region=%EC%84%9C%EC%9A%B8&theme=cafe",
  );
});

test("shouldRetry는 4xx를 다시 시도하지 않는다", () => {
  expect(shouldRetry(0, new ApiError(404, "x"))).toBe(false);
  expect(shouldRetry(0, new ApiError(500, "x"))).toBe(true);
  expect(shouldRetry(2, new ApiError(500, "x"))).toBe(false);
});

test("useRoom은 방을 불러온다", async () => {
  server.use(http.get(`${API}/rooms/abc123`, () => HttpResponse.json(room({ title: "주말" }))));
  const { result: hook } = renderHook(() => useRoom("abc123"), { wrapper: clientWrapper() });
  await waitFor(() => expect(hook.current.data?.title).toBe("주말"));
});

test("useResult는 필터를 쿼리로 보낸다", async () => {
  let seen = "";
  server.use(
    http.get(`${API}/rooms/abc123/result`, ({ request }) => {
      seen = new URL(request.url).search;
      return HttpResponse.json(result({ regions: ["경기"] }));
    }),
  );
  const { result: hook } = renderHook(() => useResult("abc123", { regions: ["경기"], theme: "any" }), {
    wrapper: clientWrapper(),
  });
  await waitFor(() => expect(hook.current.data?.regions).toEqual(["경기"]));
  expect(new URLSearchParams(seen).getAll("region")).toEqual(["경기"]);
  expect(new URLSearchParams(seen).get("theme")).toBe("any");
});

test("useAddParticipant는 본문을 보내고 결과를 돌려준다", async () => {
  let body: unknown = null;
  server.use(
    http.post(`${API}/rooms/abc123/participants`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(participant({ id: 7 }), { status: 201 });
    }),
  );
  const { result: hook } = renderHook(() => useAddParticipant("abc123"), { wrapper: clientWrapper() });
  hook.current.mutate({ nickname: "민수", station_id: 2 });
  await waitFor(() => expect(hook.current.data?.id).toBe(7));
  expect(body).toEqual({ nickname: "민수", station_id: 2 });
});

test("useSetParticipantActive는 PATCH로 active를 보낸다", async () => {
  let body: unknown = null;
  server.use(
    http.patch(`${API}/rooms/abc123/participants/7`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(participant({ id: 7, active: false }));
    }),
  );
  const { result: hook } = renderHook(() => useSetParticipantActive("abc123"), { wrapper: clientWrapper() });
  hook.current.mutate({ id: 7, active: false });
  await waitFor(() => expect(hook.current.data?.active).toBe(false));
  expect(body).toEqual({ active: false });
});

test("useStationSearch는 빈 검색어로는 부르지 않는다", async () => {
  const { result: hook } = renderHook(() => useStationSearch("  "), { wrapper: clientWrapper() });
  expect(hook.current.fetchStatus).toBe("idle");
});

test("usePlaceSearch는 검색어를 URL이 아니라 본문으로 보낸다", async () => {
  let url = "";
  let body: unknown = null;
  server.use(
    http.post(`${API}/places/search`, async ({ request }) => {
      url = request.url;
      body = await request.json();
      return HttpResponse.json({ items: [{ name: "강남구청", address: "서울 강남구 삼성동 16-1" }], error: null });
    }),
  );
  const { result: hook } = renderHook(() => usePlaceSearch("강남구청"), { wrapper: clientWrapper() });
  await waitFor(() => expect(hook.current.data?.items).toHaveLength(1));
  expect(url).toBe(`${API}/places/search`);
  expect(body).toEqual({ q: "강남구청" });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `cd frontend && npm test -- lib/api`
Expected: FAIL, `Failed to resolve import "./client"`

- [ ] **Step 4: `client.ts` 구현**

```ts
import { MSG_INVALID_INPUT, MSG_NETWORK } from "@/lib/messages";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// 백엔드의 detail 문자열이 화면 문구의 원본이다. 문자열이 아니면 프론트 문구로 대신한다.
async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return MSG_INVALID_INPUT;
  } catch {
    // 본문이 JSON이 아니다 (프록시 오류 페이지 등). 아래 연결 문구로 넘어간다.
  }
  return MSG_NETWORK;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, MSG_NETWORK);
  }
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response));
  return (await response.json()) as T;
}
```

- [ ] **Step 5: `hooks.ts` 구현**

```ts
"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { POLL_MS } from "@/lib/constants";
import { filterQuery, type ResultFilter } from "@/lib/filter";
import type { ContentKind } from "@/lib/themes";
import { ApiError, request } from "./client";
import type {
  ContentOut,
  ParticipantCreate,
  ParticipantOut,
  PlaceSearchOut,
  ResultOut,
  RoomCreate,
  RoomOut,
  StationOut,
} from "./types";

// 4xx는 다시 불러도 같은 답이라 재시도하지 않는다.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function resultPath(slug: string, filter: ResultFilter): string {
  return `/rooms/${slug}/result${filterQuery(filter)}`;
}

function invalidateRoom(client: QueryClient, slug: string): Promise<unknown> {
  return Promise.all([
    client.invalidateQueries({ queryKey: ["room", slug] }),
    client.invalidateQueries({ queryKey: ["result", slug] }),
  ]);
}

export function useRoom(slug: string) {
  return useQuery<RoomOut, ApiError>({
    queryKey: ["room", slug],
    queryFn: () => request<RoomOut>(`/rooms/${slug}`),
    refetchInterval: POLL_MS,
  });
}

export function useResult(slug: string, filter: ResultFilter, options: { poll?: boolean } = {}) {
  const path = resultPath(slug, filter);
  return useQuery<ResultOut, ApiError>({
    queryKey: ["result", slug, path],
    queryFn: () => request<ResultOut>(path),
    refetchInterval: options.poll === false ? false : POLL_MS,
    // 필터를 바꾸는 동안 이전 목록을 유지해 화면이 깜빡이지 않게 한다.
    placeholderData: keepPreviousData,
  });
}

export function useCreateRoom() {
  return useMutation<RoomOut, ApiError, RoomCreate>({
    mutationFn: (body) => request<RoomOut>("/rooms", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useAddParticipant(slug: string) {
  const client = useQueryClient();
  return useMutation<ParticipantOut, ApiError, ParticipantCreate>({
    mutationFn: (body) =>
      request<ParticipantOut>(`/rooms/${slug}/participants`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateRoom(client, slug),
  });
}

export function useSetParticipantActive(slug: string) {
  const client = useQueryClient();
  return useMutation<ParticipantOut, ApiError, { id: number; active: boolean }>({
    mutationFn: ({ id, active }) =>
      request<ParticipantOut>(`/rooms/${slug}/participants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => invalidateRoom(client, slug),
  });
}

export function useStationSearch(q: string) {
  const term = q.trim();
  return useQuery<StationOut[], ApiError>({
    queryKey: ["stations", term],
    queryFn: () => request<StationOut[]>(`/stations?q=${encodeURIComponent(term)}`),
    enabled: term.length >= 1,
    staleTime: 60_000,
  });
}

export function usePlaceSearch(q: string) {
  const term = q.trim();
  return useQuery<PlaceSearchOut, ApiError>({
    queryKey: ["places", term],
    // 주소는 개인 정보일 수 있어 URL이 아니라 본문으로 보낸다.
    queryFn: () => request<PlaceSearchOut>("/places/search", { method: "POST", body: JSON.stringify({ q: term }) }),
    enabled: term.length >= 2,
    staleTime: 60_000,
  });
}

export function useHubContent(slug: string, hubId: number, kind: ContentKind) {
  return useQuery<ContentOut, ApiError>({
    queryKey: ["content", slug, hubId, kind],
    queryFn: () => request<ContentOut>(`/rooms/${slug}/hubs/${hubId}/content?kind=${kind}`),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
```

- [ ] **Step 6: Providers 연결**

`frontend/app/providers.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { shouldRetry } from "@/lib/api/hooks";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: shouldRetry }, mutations: { retry: false } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

`frontend/app/layout.tsx`에 `import { Providers } from "./providers";`를 추가하고 `<div ...>{children}</div>`를 `<Providers>`로 감싼다.

```tsx
        <Providers>
          <div className="mx-auto min-h-dvh max-w-[480px] px-4 pb-32 pt-4">{children}</div>
        </Providers>
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd frontend && npm test`
Expected: 전부 passed (client 5개, hooks 8개 포함)

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 8: 커밋**

```bash
git add frontend/lib frontend/app
git commit -m "feat: api client, query hooks and test fixtures"
```

---
## Task 11: 공통 UI 컴포넌트

**Files:**
- Create: `frontend/components/ui/styles.ts`, `Chip.tsx`, `Stamp.tsx`, `LineBadge.tsx`, `TicketCard.tsx`, `StickyAction.tsx`, `Toast.tsx`, `StepIndicator.tsx`, `AppHeader.tsx`
- Modify: `frontend/app/providers.tsx`, `frontend/app/layout.tsx`, `frontend/lib/test/render.tsx`, `frontend/vitest.setup.ts`
- Test: `frontend/components/ui/Chip.test.tsx`, `LineBadge.test.tsx`, `Toast.test.tsx`, `StepIndicator.test.tsx`

**Interfaces:**
- Consumes: `lib/lines.ts`의 `lineStyle`, `shortLine`, `lib/constants.ts`의 `SERVICE_NAME`.
- Produces:
  - `styles.ts`: 클래스 문자열 상수 `CARD`, `INPUT`, `PRIMARY_BUTTON`, `SECONDARY_BUTTON`, `SMALL_BUTTON`
  - `Chip({ selected, onClick, children })`: `aria-pressed`를 가진 버튼
  - `Stamp({ children })`
  - `LineBadge({ line })`
  - `TicketCard({ label, children })`
  - `StickyAction({ children })`: 화면 아래 고정 영역
  - `ToastProvider({ children })`, `useToast() -> (message: string) => void`
  - `StepIndicator({ current: 1 | 2 | 3 | 4, slug?: string, query?: string })`
  - `AppHeader()`
  - `renderWithClient`가 `ToastProvider`까지 감싼다

- [ ] **Step 1: 테스트에서 `next/link`를 평범한 a 태그로 바꾸기**

`frontend/vitest.setup.ts` 맨 위 import 아래에 추가한다 (라우터 없이도 링크의 `href`를 검사할 수 있게).

```ts
import { createElement, type ReactNode } from "react";
import { vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));
```

- [ ] **Step 2: 실패하는 테스트 작성**

`frontend/components/ui/Chip.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Chip } from "./Chip";

test("선택 상태를 aria-pressed로 알리고 누르면 onClick", async () => {
  const onClick = vi.fn();
  render(<Chip selected onClick={onClick}>서울</Chip>);
  const chip = screen.getByRole("button", { name: "서울" });
  expect(chip).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(chip);
  expect(onClick).toHaveBeenCalledOnce();
});
```

`frontend/components/ui/LineBadge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { LineBadge } from "./LineBadge";

test("숫자 노선은 줄여 쓰고 전체 이름은 title로 남긴다", () => {
  render(<LineBadge line="2호선" />);
  const badge = screen.getByTitle("2호선");
  expect(badge).toHaveTextContent("2");
  expect(badge).toHaveStyle({ backgroundColor: "#00a84d" });
});
```

`frontend/components/ui/Toast.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function Trigger() {
  const toast = useToast();
  return <button onClick={() => toast("링크를 복사했어요")}>알림</button>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("문구를 띄우고 잠시 뒤 지운다", () => {
  render(<ToastProvider><Trigger /></ToastProvider>);
  act(() => screen.getByRole("button", { name: "알림" }).click());
  expect(screen.getByRole("status")).toHaveTextContent("링크를 복사했어요");
  act(() => vi.advanceTimersByTime(2500));
  expect(screen.queryByRole("status")).toBeNull();
});
```

`frontend/components/ui/StepIndicator.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { StepIndicator } from "./StepIndicator";

test("지나온 단계만 링크이고 현재 단계를 표시한다", () => {
  render(<StepIndicator current={3} slug="abc123" />);
  expect(screen.getByRole("link", { name: "1 방 만들기" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "2 참여" })).toHaveAttribute("href", "/r/abc123?add=1");
  expect(screen.queryByRole("link", { name: "3 추천" })).toBeNull();
  expect(screen.queryByRole("link", { name: "4 둘러보기" })).toBeNull();
  expect(screen.getByText("3 추천").closest("li")).toHaveAttribute("aria-current", "step");
});

test("추천 단계 링크는 필터 쿼리를 유지한다", () => {
  render(<StepIndicator current={4} slug="abc123" query="?theme=cafe" />);
  expect(screen.getByRole("link", { name: "3 추천" })).toHaveAttribute("href", "/r/abc123/result?theme=cafe");
});

test("방이 없는 첫 화면에는 링크가 없다", () => {
  render(<StepIndicator current={1} />);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});
```

Run: `cd frontend && npm test -- components/ui`
Expected: FAIL, 모듈을 찾지 못함

- [ ] **Step 3: 구현**

`frontend/components/ui/styles.ts`:

```ts
// 여러 컴포넌트가 같이 쓰는 클래스 묶음. 색은 globals.css의 토큰만 쓴다.
export const CARD = "rounded-card border border-line bg-card p-4";
export const INPUT =
  "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-primary";
export const PRIMARY_BUTTON =
  "flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 font-bold text-white active:bg-primary-soft disabled:opacity-60";
export const SECONDARY_BUTTON =
  "flex w-full items-center justify-center gap-2 rounded-full border border-line bg-card px-4 py-3 font-semibold text-ink";
export const SMALL_BUTTON =
  "shrink-0 rounded-full border border-line bg-card px-3 py-1.5 text-sm font-semibold text-ink-sub disabled:opacity-60";
```

`frontend/components/ui/Chip.tsx`:

```tsx
import type { ReactNode } from "react";

type Props = { selected: boolean; onClick: () => void; children: ReactNode };

export function Chip({ selected, onClick, children }: Props) {
  const tone = selected ? "border-primary bg-primary text-white" : "border-line bg-card text-ink-sub";
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${tone}`}
    >
      {children}
    </button>
  );
}
```

`frontend/components/ui/Stamp.tsx`:

```tsx
import type { ReactNode } from "react";

// 빨간 도장. "1위"와 "테마에 맞아요"에만 쓴다.
export function Stamp({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block -rotate-3 rounded bg-accent px-2 py-0.5 text-xs font-bold text-white">
      {children}
    </span>
  );
}
```

`frontend/components/ui/LineBadge.tsx`:

```tsx
import { lineStyle, shortLine } from "@/lib/lines";

export function LineBadge({ line }: { line: string }) {
  const { background, color } = lineStyle(line);
  return (
    <span
      title={line}
      style={{ backgroundColor: background, color }}
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
    >
      {shortLine(line)}
    </span>
  );
}
```

`frontend/components/ui/TicketCard.tsx`:

```tsx
import { Ticket } from "lucide-react";
import type { ReactNode } from "react";

// 표 모양 카드. 방 만들기 폼과 방 요약에만 쓴다.
export function TicketCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-card">
      <div className="flex items-center gap-2 rounded-t-card bg-primary px-4 py-2 text-sm font-semibold text-white">
        <Ticket size={16} aria-hidden />
        {label}
      </div>
      <div className="relative border-t border-dashed border-line p-4">
        <span aria-hidden className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-paper" />
        <span aria-hidden className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-paper" />
        {children}
      </div>
    </section>
  );
}
```

`frontend/components/ui/StickyAction.tsx`:

```tsx
import type { ReactNode } from "react";

export function StickyAction({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-[480px] px-4 py-3">{children}</div>
    </div>
  );
}
```

`frontend/components/ui/Toast.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const TOAST_MS = 2500;
const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const show = useCallback((text: string) => setMessage(text), []);

  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(() => setMessage(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message !== null && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-ink px-4 py-2 text-sm text-white"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}
```

`frontend/components/ui/StepIndicator.tsx`:

```tsx
import Link from "next/link";

const STEPS = ["방 만들기", "참여", "추천", "둘러보기"] as const;

type Props = { current: 1 | 2 | 3 | 4; slug?: string; query?: string };

function hrefFor(step: number, slug: string | undefined, query: string): string | null {
  if (!slug) return null;
  if (step === 1) return "/";
  // add=1은 "이미 등록한 브라우저는 추천으로 보낸다"는 규칙을 건너뛰게 한다.
  if (step === 2) return `/r/${slug}?add=1`;
  if (step === 3) return `/r/${slug}/result${query}`;
  return null;
}

export function StepIndicator({ current, slug, query = "" }: Props) {
  return (
    <ol aria-label="진행 단계" className="mb-4 flex items-center gap-1.5">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const href = step < current ? hrefFor(step, slug, query) : null;
        const tone =
          step === current
            ? "bg-primary text-white"
            : step < current
              ? "bg-primary-tint text-primary"
              : "bg-track text-ink-mute";
        const body = (
          <span className={`block rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
            {step} {label}
          </span>
        );
        return (
          <li key={label} aria-current={step === current ? "step" : undefined}>
            {href ? <Link href={href}>{body}</Link> : body}
          </li>
        );
      })}
    </ol>
  );
}
```

`frontend/components/ui/AppHeader.tsx`:

```tsx
import Link from "next/link";
import { SERVICE_NAME } from "@/lib/constants";

export function AppHeader() {
  return (
    <header className="mb-3">
      <Link href="/" className="text-lg font-extrabold tracking-tight text-primary">
        {SERVICE_NAME}
      </Link>
    </header>
  );
}
```

- [ ] **Step 4: Providers, 레이아웃, 테스트 도우미에 연결**

`frontend/app/providers.tsx`에 `import { ToastProvider } from "@/components/ui/Toast";`를 추가하고 반환을 바꾼다.

```tsx
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
```

`frontend/app/layout.tsx`에 `import { AppHeader } from "@/components/ui/AppHeader";`를 추가하고 본문 div 안을 바꾼다.

```tsx
          <div className="mx-auto min-h-dvh max-w-[480px] px-4 pb-32 pt-4">
            <AppHeader />
            {children}
          </div>
```

`frontend/lib/test/render.tsx`의 `clientWrapper`가 토스트까지 감싸게 한다. `import { ToastProvider } from "@/components/ui/Toast";`를 추가하고 `Wrapper`의 반환을 바꾼다.

```tsx
    return (
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd frontend && npm test`
Expected: 전부 passed (ui 6개 포함)

- [ ] **Step 6: 커밋**

```bash
git add frontend/components/ui frontend/app frontend/lib/test frontend/vitest.setup.ts
git commit -m "feat: shared ui components (chip, stamp, line badge, ticket card, toast, steps)"
```

---

## Task 12: 화면 4.1 방 만들기

**Files:**
- Create: `frontend/components/room/RegionChips.tsx`, `ThemePicker.tsx`, `CreateRoomForm.tsx`
- Modify: `frontend/app/page.tsx`
- Test: `frontend/components/room/RegionChips.test.tsx`, `ThemePicker.test.tsx`, `CreateRoomForm.test.tsx`

**Interfaces:**
- Consumes: `useCreateRoom()` (Task 10), `Chip`, `TicketCard`, `StepIndicator`, `useToast`, `styles.ts` (Task 11), `REGIONS`, `toggleRegion`, `THEMES`, `todayIso`, `copyText`, `roomUrl`, 문구 상수 (Task 9).
- Produces:
  - `RegionChips({ value: readonly Region[], onChange: (next: Region[]) => void })`
  - `ThemePicker({ value: ThemeId | null, onChange: (next: ThemeId | null) => void })`
  - `CreateRoomForm({ today: string, onCreated: (room: RoomOut) => void })`
  - `/` 경로: 방을 만들면 링크를 복사하고 `/r/{slug}`로 이동

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/components/room/RegionChips.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RegionChips } from "./RegionChips";

test("누르면 켜고 끈 결과를 넘긴다", async () => {
  const onChange = vi.fn();
  render(<RegionChips value={["서울", "경기"]} onChange={onChange} />);
  expect(screen.getByRole("button", { name: "서울" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "인천" })).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(screen.getByRole("button", { name: "경기" }));
  expect(onChange).toHaveBeenLastCalledWith(["서울"]);
  await userEvent.click(screen.getByRole("button", { name: "인천" }));
  expect(onChange).toHaveBeenLastCalledWith(["서울", "경기", "인천"]);
});

test("마지막 하나는 끄지 않는다", async () => {
  const onChange = vi.fn();
  render(<RegionChips value={["서울"]} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "서울" }));
  expect(onChange).toHaveBeenLastCalledWith(["서울"]);
});
```

`frontend/components/room/ThemePicker.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ThemePicker } from "./ThemePicker";

test("네 가지 테마를 보여주고 고른 것을 넘긴다", async () => {
  const onChange = vi.fn();
  render(<ThemePicker value={null} onChange={onChange} />);
  expect(screen.getAllByRole("button")).toHaveLength(4);
  await userEvent.click(screen.getByRole("button", { name: /술자리/ }));
  expect(onChange).toHaveBeenLastCalledWith("drink");
});

test("고른 테마를 다시 누르면 해제", async () => {
  const onChange = vi.fn();
  render(<ThemePicker value="cafe" onChange={onChange} />);
  const cafe = screen.getByRole("button", { name: /카페/ });
  expect(cafe).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(cafe);
  expect(onChange).toHaveBeenLastCalledWith(null);
});
```

`frontend/components/room/CreateRoomForm.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";
import { API, room } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { CreateRoomForm } from "./CreateRoomForm";

const TODAY = "2026-10-02";

function fill(title: string, date: string) {
  fireEvent.change(screen.getByLabelText("모임 이름"), { target: { value: title } });
  fireEvent.change(screen.getByLabelText("약속 날짜"), { target: { value: date } });
}

test("기본은 지역 셋 다 켜짐, 테마 없음", () => {
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  for (const region of ["서울", "경기", "인천"]) {
    expect(screen.getByRole("button", { name: region })).toHaveAttribute("aria-pressed", "true");
  }
  expect(screen.getByRole("button", { name: /맛집/ })).toHaveAttribute("aria-pressed", "false");
});

test("이름이 없으면 요청하지 않고 안내한다", async () => {
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  fill("   ", "2026-10-10");
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  expect(screen.getByRole("alert")).toHaveTextContent("모임 이름을 적어주세요");
});

test("지난 날짜는 요청하지 않고 안내한다", async () => {
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  fill("금요일 저녁", "2026-10-01");
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  expect(screen.getByRole("alert")).toHaveTextContent("오늘 이후 날짜를 골라주세요");
});

test("고른 지역과 테마를 보내고 만든 방을 넘긴다", async () => {
  let body: unknown = null;
  server.use(
    http.post(`${API}/rooms`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(room({ slug: "k3x9pq" }), { status: 201 });
    }),
  );
  const onCreated = vi.fn();
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={onCreated} />);
  fill("  금요일 저녁 ", "2026-10-10");
  await userEvent.click(screen.getByRole("button", { name: "경기" }));
  await userEvent.click(screen.getByRole("button", { name: /카페/ }));
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  expect(onCreated.mock.calls[0][0].slug).toBe("k3x9pq");
  expect(body).toEqual({ title: "금요일 저녁", meet_date: "2026-10-10", regions: ["서울", "인천"], theme: "cafe" });
});

test("서버 문구를 그대로 보여준다", async () => {
  server.use(http.post(`${API}/rooms`, () => HttpResponse.json({ detail: [{ msg: "x" }] }, { status: 422 })));
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  fill("금요일 저녁", "2026-10-10");
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("입력을 다시 확인해주세요");
});
```

Run: `cd frontend && npm test -- components/room`
Expected: FAIL, 모듈을 찾지 못함

- [ ] **Step 2: 구현**

`frontend/components/room/RegionChips.tsx`:

```tsx
import { Chip } from "@/components/ui/Chip";
import { REGIONS, toggleRegion, type Region } from "@/lib/regions";

type Props = { value: readonly Region[]; onChange: (next: Region[]) => void };

export function RegionChips({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="만날 지역" className="flex gap-2">
      {REGIONS.map((region) => (
        <Chip key={region} selected={value.includes(region)} onClick={() => onChange(toggleRegion(value, region))}>
          {region}
        </Chip>
      ))}
    </div>
  );
}
```

`frontend/components/room/ThemePicker.tsx`:

```tsx
import { THEMES, type ThemeId } from "@/lib/themes";

type Props = { value: ThemeId | null; onChange: (next: ThemeId | null) => void };

export function ThemePicker({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="모임 테마" className="grid grid-cols-2 gap-2">
      {THEMES.map((theme) => {
        const selected = value === theme.id;
        const tone = selected ? "border-primary bg-primary text-white" : "border-line bg-card text-ink";
        return (
          <button
            key={theme.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : theme.id)}
            className={`rounded-lg border p-3 text-left transition-colors ${tone}`}
          >
            <span className="block text-sm font-bold">{theme.label}</span>
            <span className={`block text-xs ${selected ? "text-white" : "text-ink-mute"}`}>{theme.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
```

`frontend/components/room/CreateRoomForm.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { TicketCard } from "@/components/ui/TicketCard";
import { INPUT, PRIMARY_BUTTON } from "@/components/ui/styles";
import { useCreateRoom } from "@/lib/api/hooks";
import type { RoomOut } from "@/lib/api/types";
import { MSG_DATE_REQUIRED, MSG_PRIVACY, MSG_TITLE_REQUIRED } from "@/lib/messages";
import { REGIONS, type Region } from "@/lib/regions";
import type { ThemeId } from "@/lib/themes";
import { RegionChips } from "./RegionChips";
import { ThemePicker } from "./ThemePicker";

type Props = { today: string; onCreated: (room: RoomOut) => void };

export function CreateRoomForm({ today, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [meetDate, setMeetDate] = useState("");
  const [regions, setRegions] = useState<Region[]>([...REGIONS]);
  const [theme, setTheme] = useState<ThemeId | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const create = useCreateRoom();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name) {
      setProblem(MSG_TITLE_REQUIRED);
      return;
    }
    if (!meetDate || meetDate < today) {
      setProblem(MSG_DATE_REQUIRED);
      return;
    }
    setProblem(null);
    create.mutate(
      { title: name, meet_date: meetDate, regions, theme },
      { onSuccess: onCreated, onError: (error) => setProblem(error.message) },
    );
  };

  return (
    <TicketCard label="모임 방 만들기">
      <form onSubmit={submit} noValidate className="space-y-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">모임 이름</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={40}
            placeholder="금요일 저녁 모임"
            className={INPUT}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">약속 날짜</span>
          <input
            type="date"
            value={meetDate}
            min={today}
            onChange={(event) => setMeetDate(event.target.value)}
            className={INPUT}
          />
        </label>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">어디서 만날까요</legend>
          <RegionChips value={regions} onChange={setRegions} />
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">어떤 모임인가요 (선택)</legend>
          <ThemePicker value={theme} onChange={setTheme} />
        </fieldset>
        <p className="rounded-lg bg-track p-3 text-xs text-ink-sub">{MSG_PRIVACY}</p>
        {problem !== null && (
          <p role="alert" className="text-sm font-semibold text-accent">
            {problem}
          </p>
        )}
        <button type="submit" disabled={create.isPending} className={PRIMARY_BUTTON}>
          {create.isPending ? "만드는 중" : "방 만들고 링크 받기"}
        </button>
      </form>
    </TicketCard>
  );
}
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `cd frontend && npm test -- components/room`
Expected: 9 passed

- [ ] **Step 4: 페이지 연결**

`frontend/app/page.tsx` 전체를 바꾼다.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { CreateRoomForm } from "@/components/room/CreateRoomForm";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { useToast } from "@/components/ui/Toast";
import { CARD } from "@/components/ui/styles";
import type { RoomOut } from "@/lib/api/types";
import { todayIso } from "@/lib/format";
import { MSG_ROOM_CREATED, MSG_ROOM_CREATED_NO_COPY } from "@/lib/messages";
import { copyText, roomUrl } from "@/lib/share";

const HOW_IT_WORKS = [
  { title: "방을 만들고 링크를 공유해요", body: "모임 이름과 날짜만 적으면 초대 링크가 생겨요." },
  { title: "각자 출발지를 넣어요", body: "가입 없이 가까운 지하철역이나 주소를 고르면 끝이에요." },
  { title: "공평한 장소를 추천받아요", body: "가장 오래 걸리는 사람의 이동시간이 가장 짧은 곳부터 보여줘요." },
];

export default function HomePage() {
  const router = useRouter();
  const toast = useToast();

  const onCreated = async (room: RoomOut) => {
    const copied = await copyText(roomUrl(room.slug));
    toast(copied ? MSG_ROOM_CREATED : MSG_ROOM_CREATED_NO_COPY);
    router.push(`/r/${room.slug}`);
  };

  return (
    <main className="space-y-5">
      <StepIndicator current={1} />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">모두에게 공평한 만남 장소</h1>
        <p className="mt-1 text-sm text-ink-sub">출발지만 넣으면 놀 거리가 있는 중간 지점을 찾아줘요.</p>
      </div>
      <CreateRoomForm today={todayIso()} onCreated={onCreated} />
      <section className={`${CARD} space-y-3`}>
        <h2 className="font-bold">이렇게 써요</h2>
        <ol className="space-y-3">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-sm text-ink-sub">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: 브라우저 확인**

백엔드와 프론트를 띄우고 http://localhost:3000 에서:
- 지역 칩 세 개가 켜져 있고 하나만 남기면 더 꺼지지 않는다
- 이름 없이 누르면 "모임 이름을 적어주세요"
- 이름과 날짜를 넣고 테마를 하나 골라 만들면 주소가 `/r/{6자리}`로 바뀐다 (그 화면은 아직 404, Task 13에서 만든다)
- 백엔드 `http://localhost:8000/rooms/{slug}` 응답에 고른 `regions`, `theme`이 있다

스크린샷을 찍어 사용자에게 보여준다.

- [ ] **Step 6: 커밋**

Run: `cd frontend && npm run lint && npx tsc --noEmit`
Expected: 에러 없음

```bash
git add frontend/components/room frontend/app/page.tsx
git commit -m "feat: create room screen with regions and theme"
```

---

## Task 13: 화면 4.2 참여

**Files:**
- Create: `frontend/components/join/RoomGate.tsx`, `RoomSummary.tsx`, `ShareButtons.tsx`, `OriginSearch.tsx`, `JoinForm.tsx`, `Roster.tsx`, `JoinScreen.tsx`
- Create: `frontend/app/r/[slug]/layout.tsx`, `frontend/app/r/[slug]/page.tsx`
- Test: `frontend/components/join/RoomGate.test.tsx`, `RoomSummary.test.tsx`, `Roster.test.tsx`, `JoinForm.test.tsx`, `JoinScreen.test.tsx`

**Interfaces:**
- Consumes: `useRoom`, `useAddParticipant`, `useSetParticipantActive`, `useStationSearch`, `usePlaceSearch` (Task 10), `useDebounced`, `readMine`, `addMine`, `copyText`, `roomUrl`, `formatMeetDate`, `dday`, `themeLabel`, 문구 상수, `MAX_PARTICIPANTS` (Task 9), UI 컴포넌트 (Task 11).
- Produces:
  - `RoomGate({ slug, children: (room: RoomOut) => ReactNode })`: 불러오는 중, 404와 410 안내, 성공 시 children
  - `RoomSummary({ room, now?: Date })`
  - `ShareButtons({ slug, title })`
  - `type Origin = { kind: "station"; stationId: number; label: string } | { kind: "address"; address: string; label: string }`, `type OriginMode = "station" | "address"`
  - `OriginSearch({ mode, onModeChange, value, onChange })`
  - `JoinForm({ slug, onJoined: (participant: ParticipantOut) => void })`
  - `Roster({ participants, mine, busyId, onSetActive: (participant, active) => void })`
  - `JoinScreen({ slug, room, onShowResult: () => void })`
  - 경로 `/r/[slug]`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/components/join/RoomGate.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { API, room } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { RoomGate } from "./RoomGate";

test("방을 불러오면 children에 넘긴다", async () => {
  server.use(http.get(`${API}/rooms/abc123`, () => HttpResponse.json(room({ title: "주말 모임" }))));
  renderWithClient(<RoomGate slug="abc123">{(r) => <p>{r.title}</p>}</RoomGate>);
  expect(screen.getByText("불러오는 중이에요")).toBeInTheDocument();
  expect(await screen.findByText("주말 모임")).toBeInTheDocument();
});

test.each([
  [404, "방을 찾을 수 없어요"],
  [410, "약속이 지난 방이에요"],
])("%i이면 백엔드 문구와 새 방 만들기 링크", async (status, detail) => {
  server.use(http.get(`${API}/rooms/abc123`, () => HttpResponse.json({ detail }, { status })));
  renderWithClient(<RoomGate slug="abc123">{() => <p>내용</p>}</RoomGate>);
  expect(await screen.findByRole("alert")).toHaveTextContent(detail);
  expect(screen.getByRole("link", { name: "새 방 만들기" })).toHaveAttribute("href", "/");
  expect(screen.queryByText("내용")).toBeNull();
});
```

`frontend/components/join/RoomSummary.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { room } from "@/lib/test/fixtures";
import { RoomSummary } from "./RoomSummary";

test("이름, 날짜, D-day, 지역, 테마, 자동 삭제 안내를 보여준다", () => {
  render(
    <RoomSummary
      room={room({ title: "금요일 저녁", meet_date: "2026-10-10", regions: ["서울", "경기"], theme: "drink" })}
      now={new Date(2026, 9, 6)}
    />,
  );
  expect(screen.getByRole("heading", { name: "금요일 저녁" })).toBeInTheDocument();
  expect(screen.getByText("10월 10일 (토)")).toBeInTheDocument();
  expect(screen.getByText("D-4")).toBeInTheDocument();
  expect(screen.getByText("서울, 경기, 술자리")).toBeInTheDocument();
  expect(screen.getByText("약속 7일 뒤 자동 삭제")).toBeInTheDocument();
});
```

`frontend/components/join/Roster.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { participant } from "@/lib/test/fixtures";
import { Roster } from "./Roster";

const PEOPLE = [
  participant({ id: 1, nickname: "민수", nearest_station_name: "강남" }),
  participant({ id: 2, nickname: "수진", nearest_station_name: "신림", via: "bus" }),
  participant({ id: 3, nickname: "현우", nearest_station_name: "사당", active: false }),
];

test("참여와 빠진 사람을 나눠 보여준다", () => {
  render(<Roster participants={PEOPLE} mine={[1]} busyId={null} onSetActive={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "참여 2명, 빠진 사람 1명" })).toBeInTheDocument();
  expect(screen.getByText("내가 등록")).toBeInTheDocument();
  expect(screen.getByText("신림 출발, 버스 15분 포함")).toBeInTheDocument();
  const away = screen.getByRole("heading", { name: "빠진 사람" }).parentElement as HTMLElement;
  expect(within(away).getByText("현우")).toBeInTheDocument();
});

test("빠진 사람이 없으면 참여 인원만 쓴다", () => {
  render(<Roster participants={PEOPLE.slice(0, 2)} mine={[]} busyId={null} onSetActive={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "참여 2명" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "빠진 사람" })).toBeNull();
});

test("빼기와 다시 넣기는 대상과 바꿀 상태를 넘긴다", async () => {
  const onSetActive = vi.fn();
  render(<Roster participants={PEOPLE} mine={[]} busyId={null} onSetActive={onSetActive} />);
  await userEvent.click(screen.getByRole("button", { name: "민수 빼기" }));
  expect(onSetActive).toHaveBeenLastCalledWith(PEOPLE[0], false);
  await userEvent.click(screen.getByRole("button", { name: "현우 다시 넣기" }));
  expect(onSetActive).toHaveBeenLastCalledWith(PEOPLE[2], true);
});

test("아무도 없으면 안내 문구", () => {
  render(<Roster participants={[]} mine={[]} busyId={null} onSetActive={vi.fn()} />);
  expect(screen.getByText("아직 아무도 없어요. 첫 번째로 출발지를 넣어보세요.")).toBeInTheDocument();
});
```

`frontend/components/join/JoinForm.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";
import { API, participant } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { JoinForm } from "./JoinForm";

const STATIONS = [
  { id: 222, name: "강남", line: "2호선" },
  { id: 901, name: "강남", line: "신분당선" },
];

function stationHandler() {
  return http.get(`${API}/stations`, () => HttpResponse.json(STATIONS));
}

test("역을 골라 등록하면 station_id를 보내고 폼을 비운다", async () => {
  let body: unknown = null;
  server.use(
    stationHandler(),
    http.post(`${API}/rooms/abc123/participants`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(participant({ id: 7, nickname: "민수" }), { status: 201 });
    }),
  );
  const onJoined = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<JoinForm slug="abc123" onJoined={onJoined} />);

  await user.type(screen.getByLabelText("닉네임"), " 민수 ");
  await user.type(screen.getByLabelText("출발지 검색"), "강남");
  await user.click(await screen.findByRole("button", { name: /강남.*신분당선/ }));
  expect(screen.getByText("출발지: 강남 (신분당선)")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));

  await waitFor(() => expect(onJoined).toHaveBeenCalledOnce());
  expect(body).toEqual({ nickname: "민수", station_id: 901 });
  expect(screen.getByLabelText("닉네임")).toHaveValue("");
  expect(screen.getByLabelText("출발지 검색")).toHaveValue("");
});

test("닉네임과 출발지가 없으면 요청하지 않는다", async () => {
  const user = userEvent.setup();
  renderWithClient(<JoinForm slug="abc123" onJoined={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));
  expect(screen.getByRole("alert")).toHaveTextContent("닉네임을 적어주세요");
  await user.type(screen.getByLabelText("닉네임"), "민수");
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));
  expect(screen.getByRole("alert")).toHaveTextContent("출발지를 골라주세요");
});

test("주소를 못 찾으면 문구를 보여주고 역 선택으로 돌린다", async () => {
  server.use(
    http.post(`${API}/places/search`, () =>
      HttpResponse.json({ items: [{ name: "우리집", address: "서울 어딘가 1" }], error: null }),
    ),
    http.post(`${API}/rooms/abc123/participants`, () =>
      HttpResponse.json({ detail: "주소를 찾지 못했어요. 역을 직접 골라주세요." }, { status: 422 }),
    ),
  );
  const user = userEvent.setup();
  renderWithClient(<JoinForm slug="abc123" onJoined={vi.fn()} />);
  await user.type(screen.getByLabelText("닉네임"), "민수");
  await user.click(screen.getByRole("tab", { name: "주소, 건물명 검색" }));
  await user.type(screen.getByLabelText("출발지 검색"), "우리집");
  await user.click(await screen.findByRole("button", { name: /우리집/ }));
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("주소를 찾지 못했어요. 역을 직접 골라주세요.");
  expect(screen.getByRole("tab", { name: "지하철역 선택" })).toHaveAttribute("aria-selected", "true");
});

test("주소 검색이 실패하면 안내 문구를 보여준다", async () => {
  server.use(
    http.post(`${API}/places/search`, () => HttpResponse.json({ items: [], error: "지금 불러올 수 없어요" })),
  );
  const user = userEvent.setup();
  renderWithClient(<JoinForm slug="abc123" onJoined={vi.fn()} />);
  await user.click(screen.getByRole("tab", { name: "주소, 건물명 검색" }));
  await user.type(screen.getByLabelText("출발지 검색"), "강남역");
  expect(await screen.findByText("지금 불러올 수 없어요")).toBeInTheDocument();
});
```

`frontend/components/join/JoinScreen.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, expect, test, vi } from "vitest";
import { API, participant, room } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { JoinScreen } from "./JoinScreen";

afterEach(() => vi.restoreAllMocks());

const TWO = [participant({ id: 1, nickname: "민수" }), participant({ id: 2, nickname: "수진" })];

test("두 명 이상이면 추천 보기 버튼", async () => {
  const onShowResult = vi.fn();
  renderWithClient(<JoinScreen slug="abc123" room={room({ participants: TWO })} onShowResult={onShowResult} />);
  await userEvent.click(screen.getByRole("button", { name: "추천 보기 (2명)" }));
  expect(onShowResult).toHaveBeenCalledOnce();
});

test("빠진 사람은 인원에서 빼고, 한 명 이하면 초대 안내", () => {
  const people = [TWO[0], { ...TWO[1], active: false }];
  renderWithClient(<JoinScreen slug="abc123" room={room({ participants: people })} onShowResult={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /추천 보기/ })).toBeNull();
  expect(screen.getByText("친구를 초대하세요. 두 명부터 추천이 나와요.")).toBeInTheDocument();
});

test("스무 명이면 폼 대신 가득 찼다는 안내", () => {
  const twenty = Array.from({ length: 20 }, (_, i) => participant({ id: i + 1, nickname: `참여자${i}` }));
  renderWithClient(<JoinScreen slug="abc123" room={room({ participants: twenty })} onShowResult={vi.fn()} />);
  expect(screen.getByText("참여 인원이 가득 찼어요 (최대 20명)")).toBeInTheDocument();
  expect(screen.queryByLabelText("닉네임")).toBeNull();
});

test("빼기는 확인을 받은 뒤 PATCH를 보낸다", async () => {
  let body: unknown = null;
  server.use(
    http.patch(`${API}/rooms/abc123/participants/1`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(participant({ id: 1, active: false }));
    }),
  );
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  renderWithClient(<JoinScreen slug="abc123" room={room({ participants: TWO })} onShowResult={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "민수 빼기" }));
  expect(confirm).toHaveBeenCalledWith("민수님을 계산에서 뺄까요? 다시 넣을 수 있어요");
  await waitFor(() => expect(body).toEqual({ active: false }));
});

test("확인을 취소하면 요청하지 않는다", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  renderWithClient(<JoinScreen slug="abc123" room={room({ participants: TWO })} onShowResult={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "민수 빼기" }));
  // 요청이 나갔다면 핸들러가 없어 MSW가 테스트를 실패시킨다
});

test("다시 넣기는 확인 없이 보낸다", async () => {
  let body: unknown = null;
  server.use(
    http.patch(`${API}/rooms/abc123/participants/2`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(participant({ id: 2, active: true }));
    }),
  );
  const confirm = vi.spyOn(window, "confirm");
  const people = [TWO[0], { ...TWO[1], active: false }];
  renderWithClient(<JoinScreen slug="abc123" room={room({ participants: people })} onShowResult={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "수진 다시 넣기" }));
  await waitFor(() => expect(body).toEqual({ active: true }));
  expect(confirm).not.toHaveBeenCalled();
});

test("등록하면 이 브라우저가 넣은 사람으로 기억한다", async () => {
  server.use(
    http.get(`${API}/stations`, () => HttpResponse.json([{ id: 222, name: "강남", line: "2호선" }])),
    http.post(`${API}/rooms/abc123/participants`, () =>
      HttpResponse.json(participant({ id: 9, nickname: "지은" }), { status: 201 }),
    ),
  );
  const user = userEvent.setup();
  renderWithClient(<JoinScreen slug="abc123" room={room()} onShowResult={vi.fn()} />);
  await user.type(screen.getByLabelText("닉네임"), "지은");
  await user.type(screen.getByLabelText("출발지 검색"), "강남");
  await user.click(await screen.findByRole("button", { name: /강남/ }));
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));
  await waitFor(() => expect(window.localStorage.getItem("wjm:room:abc123:mine")).toBe("[9]"));
});
```

Run: `cd frontend && npm test -- components/join`
Expected: FAIL, 모듈을 찾지 못함

- [ ] **Step 2: 구현 (표시 컴포넌트)**

`frontend/components/join/RoomGate.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CARD, PRIMARY_BUTTON } from "@/components/ui/styles";
import { useRoom } from "@/lib/api/hooks";
import type { RoomOut } from "@/lib/api/types";
import { MSG_LOADING } from "@/lib/messages";

type Props = { slug: string; children: (room: RoomOut) => ReactNode };

export function RoomGate({ slug, children }: Props) {
  const room = useRoom(slug);
  // 한번 불러온 뒤에는 폴링이 잠깐 실패해도 마지막 내용을 계속 보여준다.
  if (room.data) return <>{children(room.data)}</>;
  if (room.error) {
    return (
      <section role="alert" className={`${CARD} space-y-4 text-center`}>
        <p className="font-semibold">{room.error.message}</p>
        <Link href="/" className={PRIMARY_BUTTON}>
          새 방 만들기
        </Link>
      </section>
    );
  }
  return <p className="py-10 text-center text-ink-mute">{MSG_LOADING}</p>;
}
```

`frontend/components/join/RoomSummary.tsx`:

```tsx
import { TicketCard } from "@/components/ui/TicketCard";
import type { RoomOut } from "@/lib/api/types";
import { dday, formatMeetDate } from "@/lib/format";
import { MSG_AUTO_DELETE } from "@/lib/messages";
import { themeLabel } from "@/lib/themes";

export function RoomSummary({ room, now = new Date() }: { room: RoomOut; now?: Date }) {
  const theme = themeLabel(room.theme);
  const scope = [...room.regions, ...(theme ? [theme] : [])].join(", ");
  return (
    <TicketCard label="모임 정보">
      <h1 className="text-xl font-extrabold tracking-tight">{room.title}</h1>
      <p className="mt-1 flex items-center gap-2 text-sm text-ink-sub">
        <span>{formatMeetDate(room.meet_date)}</span>
        <span className="rounded bg-primary-tint px-1.5 py-0.5 text-xs font-bold text-primary">
          {dday(room.meet_date, now)}
        </span>
      </p>
      <p className="mt-2 text-sm text-ink-sub">{scope}</p>
      <p className="mt-1 text-xs text-ink-mute">{MSG_AUTO_DELETE}</p>
    </TicketCard>
  );
}
```

`frontend/components/join/ShareButtons.tsx`:

```tsx
"use client";

import { Link2, Share2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useToast } from "@/components/ui/Toast";
import { SECONDARY_BUTTON } from "@/components/ui/styles";
import { MSG_LINK_COPIED, MSG_LINK_COPY_FAILED } from "@/lib/messages";
import { copyText, roomUrl } from "@/lib/share";

const noSubscribe = () => () => {};

export function ShareButtons({ slug, title }: { slug: string; title: string }) {
  const toast = useToast();
  // 서버 렌더와 첫 클라이언트 렌더가 같도록 공유 기능 유무는 마운트 뒤에만 읽는다.
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  const copy = async () => {
    toast((await copyText(roomUrl(slug))) ? MSG_LINK_COPIED : MSG_LINK_COPY_FAILED);
  };
  const share = () => {
    // 사용자가 공유창을 닫으면 거절된다. 따로 할 일이 없다.
    navigator.share({ title, url: roomUrl(slug) }).catch(() => {});
  };

  return (
    <div className={`grid gap-2 ${canShare ? "grid-cols-2" : "grid-cols-1"}`}>
      <button type="button" onClick={copy} className={SECONDARY_BUTTON}>
        <Link2 size={16} aria-hidden />
        초대 링크 복사
      </button>
      {canShare && (
        <button type="button" onClick={share} className={SECONDARY_BUTTON}>
          <Share2 size={16} aria-hidden />
          공유하기
        </button>
      )}
    </div>
  );
}
```

`frontend/components/join/Roster.tsx`:

```tsx
import { CARD, SMALL_BUTTON } from "@/components/ui/styles";
import type { ParticipantOut } from "@/lib/api/types";
import { MSG_BUS, MSG_EMPTY_ROSTER } from "@/lib/messages";

type Props = {
  participants: readonly ParticipantOut[];
  mine: readonly number[];
  busyId: number | null;
  onSetActive: (participant: ParticipantOut, active: boolean) => void;
};

type RowProps = { participant: ParticipantOut; isMine: boolean; busy: boolean; onSetActive: Props["onSetActive"] };

function Row({ participant, isMine, busy, onSetActive }: RowProps) {
  const action = participant.active ? "빼기" : "다시 넣기";
  const origin = `${participant.nearest_station_name} 출발${participant.via === "bus" ? `, ${MSG_BUS}` : ""}`;
  return (
    <li className={`flex items-center justify-between gap-2 ${participant.active ? "" : "opacity-60"}`}>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-semibold">
          <span className="truncate">{participant.nickname}</span>
          {isMine && (
            <span className="shrink-0 rounded bg-primary-tint px-1.5 py-0.5 text-[11px] font-bold text-primary">
              내가 등록
            </span>
          )}
        </p>
        <p className="truncate text-sm text-ink-sub">{origin}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        aria-label={`${participant.nickname} ${action}`}
        onClick={() => onSetActive(participant, !participant.active)}
        className={SMALL_BUTTON}
      >
        {action}
      </button>
    </li>
  );
}

export function Roster({ participants, mine, busyId, onSetActive }: Props) {
  const present = participants.filter((p) => p.active);
  const away = participants.filter((p) => !p.active);
  const heading = away.length > 0 ? `참여 ${present.length}명, 빠진 사람 ${away.length}명` : `참여 ${present.length}명`;
  const row = (p: ParticipantOut) => (
    <Row key={p.id} participant={p} isMine={mine.includes(p.id)} busy={busyId === p.id} onSetActive={onSetActive} />
  );
  return (
    <section className={`${CARD} space-y-3`}>
      <h2 className="font-bold">{heading}</h2>
      {present.length === 0 && <p className="text-sm text-ink-mute">{MSG_EMPTY_ROSTER}</p>}
      <ul className="space-y-3">{present.map(row)}</ul>
      {away.length > 0 && (
        <div className="space-y-3 border-t border-line pt-3">
          <h3 className="text-sm font-semibold text-ink-mute">빠진 사람</h3>
          <ul className="space-y-3">{away.map(row)}</ul>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: 구현 (입력 컴포넌트)**

`frontend/components/join/OriginSearch.tsx`:

```tsx
"use client";

import { useState } from "react";
import { LineBadge } from "@/components/ui/LineBadge";
import { INPUT } from "@/components/ui/styles";
import { usePlaceSearch, useStationSearch } from "@/lib/api/hooks";
import { MSG_NO_SEARCH_RESULT } from "@/lib/messages";
import { useDebounced } from "@/lib/useDebounced";

export type Origin =
  | { kind: "station"; stationId: number; label: string }
  | { kind: "address"; address: string; label: string };
export type OriginMode = "station" | "address";

type Props = {
  mode: OriginMode;
  onModeChange: (mode: OriginMode) => void;
  value: Origin | null;
  onChange: (origin: Origin | null) => void;
};

const MODES: readonly { id: OriginMode; label: string; placeholder: string }[] = [
  { id: "station", label: "지하철역 선택", placeholder: "역 이름 (강남)" },
  { id: "address", label: "주소, 건물명 검색", placeholder: "주소나 건물 이름 (테헤란로 152)" },
];
const RESULT_BUTTON = "flex w-full items-center gap-2 rounded-lg border border-line bg-card p-3 text-left";

export function OriginSearch({ mode, onModeChange, value, onChange }: Props) {
  const [text, setText] = useState("");
  const term = useDebounced(text);
  const stations = useStationSearch(mode === "station" ? term : "");
  const places = usePlaceSearch(mode === "address" ? term : "");

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-primary-tint p-3">
        <span className="font-semibold text-primary">출발지: {value.label}</span>
        <button type="button" onClick={() => onChange(null)} className="shrink-0 text-sm font-semibold text-primary underline">
          다시 고르기
        </button>
      </div>
    );
  }

  const settled = term.trim() === text.trim();
  const stationItems = stations.data ?? [];
  const placeItems = places.data?.items ?? [];
  const searched = mode === "station" ? stations.isSuccess : places.isSuccess;
  const empty = settled && searched && (mode === "station" ? stationItems : placeItems).length === 0;

  return (
    <div className="space-y-2">
      <div role="tablist" aria-label="출발지 입력 방식" className="grid grid-cols-2 gap-1 rounded-lg bg-track p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => onModeChange(m.id)}
            className={`rounded-md py-2 text-sm font-semibold ${mode === m.id ? "bg-card text-primary" : "text-ink-sub"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <input
        aria-label="출발지 검색"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={MODES.find((m) => m.id === mode)?.placeholder}
        className={INPUT}
      />
      {mode === "address" && places.data?.error && <p className="text-sm text-accent">{places.data.error}</p>}
      {empty && !(mode === "address" && places.data?.error) && (
        <p className="text-sm text-ink-mute">{MSG_NO_SEARCH_RESULT}</p>
      )}
      <ul className="space-y-1.5">
        {mode === "station" &&
          stationItems.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onChange({ kind: "station", stationId: s.id, label: `${s.name} (${s.line})` })}
                className={RESULT_BUTTON}
              >
                <span className="font-semibold">{s.name}</span>
                <LineBadge line={s.line} />
                <span className="text-sm text-ink-mute">{s.line}</span>
              </button>
            </li>
          ))}
        {mode === "address" &&
          placeItems.map((p) => (
            <li key={`${p.name}:${p.address}`}>
              <button
                type="button"
                onClick={() => onChange({ kind: "address", address: p.address, label: p.name })}
                className={RESULT_BUTTON}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block truncate text-sm text-ink-mute">{p.address}</span>
                </span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
```

`frontend/components/join/JoinForm.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { CARD, INPUT, PRIMARY_BUTTON } from "@/components/ui/styles";
import { useAddParticipant } from "@/lib/api/hooks";
import type { ParticipantOut } from "@/lib/api/types";
import { MSG_NICKNAME_REQUIRED, MSG_ORIGIN_REQUIRED } from "@/lib/messages";
import { OriginSearch, type Origin, type OriginMode } from "./OriginSearch";

type Props = { slug: string; onJoined: (participant: ParticipantOut) => void };

export function JoinForm({ slug, onJoined }: Props) {
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState<OriginMode>("station");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // 등록에 성공할 때마다 올려서 검색창을 새로 만든다 (입력한 검색어를 비우기 위해).
  const [round, setRound] = useState(0);
  const add = useAddParticipant(slug);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = nickname.trim();
    if (!name) {
      setProblem(MSG_NICKNAME_REQUIRED);
      return;
    }
    if (!origin) {
      setProblem(MSG_ORIGIN_REQUIRED);
      return;
    }
    setProblem(null);
    const body =
      origin.kind === "station"
        ? { nickname: name, station_id: origin.stationId }
        : { nickname: name, address: origin.address };
    add.mutate(body, {
      onSuccess: (participant) => {
        setNickname("");
        setOrigin(null);
        setRound((n) => n + 1);
        onJoined(participant);
      },
      onError: (error) => {
        setProblem(error.message);
        // 주소를 좌표로 못 바꾼 경우에는 역 선택으로 안내한다.
        if (origin.kind === "address" && (error.status === 422 || error.status === 503)) {
          setOrigin(null);
          setMode("station");
        }
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className={`${CARD} space-y-4`}>
      <h2 className="font-bold">출발지 등록</h2>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">닉네임</span>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={20}
          placeholder="친구들이 알아볼 이름"
          className={INPUT}
        />
      </label>
      <OriginSearch
        key={`${round}:${mode}`}
        mode={mode}
        onModeChange={(next) => {
          setOrigin(null);
          setMode(next);
        }}
        value={origin}
        onChange={setOrigin}
      />
      {problem !== null && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {problem}
        </p>
      )}
      <button type="submit" disabled={add.isPending} className={PRIMARY_BUTTON}>
        {add.isPending ? "등록하는 중" : "출발지 등록"}
      </button>
    </form>
  );
}
```

제목 "출발지 등록"(h2)과 버튼 "출발지 등록"이 같은 글자지만 테스트는 `getByRole("button", ...)`로 찾으므로 겹치지 않는다.

`frontend/components/join/JoinScreen.tsx`:

```tsx
"use client";

import { useState } from "react";
import { StickyAction } from "@/components/ui/StickyAction";
import { CARD, PRIMARY_BUTTON } from "@/components/ui/styles";
import { useSetParticipantActive } from "@/lib/api/hooks";
import type { ParticipantOut, RoomOut } from "@/lib/api/types";
import { MAX_PARTICIPANTS } from "@/lib/constants";
import { MSG_NEED_TWO, MSG_ROOM_FULL, msgConfirmRemove } from "@/lib/messages";
import { addMine, readMine } from "@/lib/myParticipants";
import { JoinForm } from "./JoinForm";
import { RoomSummary } from "./RoomSummary";
import { Roster } from "./Roster";
import { ShareButtons } from "./ShareButtons";

type Props = { slug: string; room: RoomOut; onShowResult: () => void };

export function JoinScreen({ slug, room, onShowResult }: Props) {
  const [mine, setMine] = useState(() => readMine(slug));
  const [problem, setProblem] = useState<string | null>(null);
  const setActive = useSetParticipantActive(slug);
  const presentCount = room.participants.filter((p) => p.active).length;
  // 정원은 빠진 사람을 포함한 전체 인원으로 센다 (백엔드와 같은 기준).
  const full = room.participants.length >= MAX_PARTICIPANTS;

  const onSetActive = (participant: ParticipantOut, active: boolean) => {
    if (!active && !window.confirm(msgConfirmRemove(participant.nickname))) return;
    setProblem(null);
    setActive.mutate({ id: participant.id, active }, { onError: (error) => setProblem(error.message) });
  };

  return (
    <div className="space-y-4">
      <RoomSummary room={room} />
      <ShareButtons slug={slug} title={room.title} />
      {full ? (
        <p className={`${CARD} text-center font-semibold`}>{MSG_ROOM_FULL}</p>
      ) : (
        <JoinForm slug={slug} onJoined={(participant) => setMine(addMine(slug, participant.id))} />
      )}
      {problem !== null && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {problem}
        </p>
      )}
      <Roster
        participants={room.participants}
        mine={mine}
        busyId={setActive.isPending ? (setActive.variables?.id ?? null) : null}
        onSetActive={onSetActive}
      />
      <StickyAction>
        {presentCount >= 2 ? (
          <button type="button" onClick={onShowResult} className={PRIMARY_BUTTON}>
            추천 보기 ({presentCount}명)
          </button>
        ) : (
          <p className="py-1 text-center text-sm font-semibold text-ink-sub">{MSG_NEED_TWO}</p>
        )}
      </StickyAction>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npm test -- components/join`
Expected: 19 passed (RoomGate 3, RoomSummary 1, Roster 4, JoinForm 4, JoinScreen 7)

- [ ] **Step 5: 경로 연결**

`frontend/app/r/[slug]/layout.tsx` (서버 컴포넌트. 카톡 등에 링크를 붙였을 때 방 이름이 미리보기 제목으로 나오게 한다):

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { API_BASE } from "@/lib/api/client";
import type { RoomOut } from "@/lib/api/types";
import { SERVICE_NAME } from "@/lib/constants";
import { formatMeetDate } from "@/lib/format";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  try {
    const response = await fetch(`${API_BASE}/rooms/${slug}`, { cache: "no-store" });
    if (!response.ok) return { title: SERVICE_NAME };
    const room = (await response.json()) as RoomOut;
    return {
      title: `${room.title} | ${SERVICE_NAME}`,
      description: `${formatMeetDate(room.meet_date)} 약속. 출발지를 넣으면 모두에게 공평한 장소를 찾아줘요.`,
    };
  } catch {
    // 백엔드에 닿지 못해도 화면은 떠야 한다. 제목만 기본값으로 둔다.
    return { title: SERVICE_NAME };
  }
}

export default function RoomLayout({ children }: { children: ReactNode }) {
  return children;
}
```

`frontend/app/r/[slug]/page.tsx`:

```tsx
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { JoinScreen } from "@/components/join/JoinScreen";
import { RoomGate } from "@/components/join/RoomGate";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { readMine } from "@/lib/myParticipants";

function JoinPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const adding = useSearchParams().get("add") === "1";

  // 이미 누군가를 등록한 브라우저는 추천으로 보낸다. "사람 추가"로 돌아온 경우(add=1)는 예외.
  useEffect(() => {
    if (!adding && readMine(slug).length > 0) router.replace(`/r/${slug}/result`);
  }, [adding, slug, router]);

  return (
    <main>
      <StepIndicator current={2} slug={slug} />
      <RoomGate slug={slug}>
        {(room) => <JoinScreen slug={slug} room={room} onShowResult={() => router.push(`/r/${slug}/result`)} />}
      </RoomGate>
    </main>
  );
}

export default function Page() {
  // useSearchParams를 쓰는 클라이언트 페이지는 Suspense 경계가 있어야 빌드된다.
  return (
    <Suspense fallback={null}>
      <JoinPage />
    </Suspense>
  );
}
```

- [ ] **Step 6: 브라우저 확인**

http://localhost:3000 에서 방을 만든 뒤:
- 방 요약(이름, 날짜, D-day, 지역과 테마, 자동 삭제 안내)이 보인다
- "강남"을 검색하면 노선 뱃지가 붙은 역 목록이 나오고, 골라 등록하면 명부에 "내가 등록"과 함께 나타난다
- 주소 탭에서 "강남역"을 검색하면 장소 목록이 나온다 (카카오 키가 없으면 "지금 불러올 수 없어요")
- 두 명을 넣으면 아래 버튼이 "추천 보기 (2명)"으로 바뀐다
- 한 명을 빼면 "빠진 사람"으로 내려가고 버튼이 초대 안내로 돌아온다. 다시 넣으면 돌아온다
- 없는 주소 `/r/zzzzzz`는 "방을 찾을 수 없어요"와 새 방 만들기
- 페이지 제목(브라우저 탭)이 "방 이름 | 우리지금만나"

스크린샷(모바일 폭 375)을 찍어 사용자에게 보여준다.

- [ ] **Step 7: 커밋**

Run: `cd frontend && npm test && npm run lint && npx tsc --noEmit && npm run build`
Expected: 전부 통과

```bash
git add frontend/components/join frontend/app/r
git commit -m "feat: join screen with origin search, roster and participant removal"
```

---
## Task 14: 화면 4.3 거점 추천 (지도 제외)

**Files:**
- Create: `frontend/components/result/FilterBar.tsx`, `FairnessStats.tsx`, `LegBars.tsx`, `HubCard.tsx`, `ResultScreen.tsx`
- Create: `frontend/app/r/[slug]/result/page.tsx`
- Test: `frontend/components/result/FilterBar.test.tsx`, `LegBars.test.tsx`, `ResultScreen.test.tsx`

**Interfaces:**
- Consumes: `useResult(slug, filter)` (Task 10), `ResultFilter`, `filterQuery`, `filterFromSearch`, `parseRegions`, `isAllRegions`, `THEMES`, `THEME_OFF`, `aboutMinutes`, `average`, `readMine`, `copyText`, 문구 상수 (Task 9), `Chip`, `Stamp`, `LineBadge`, `StickyAction`, `useToast`, `styles.ts` (Task 11), `RegionChips` (Task 12), `ShareButtons` (Task 13).
- Produces:
  - `FilterBar({ filter, appliedRegions, appliedTheme, onChange: (next: ResultFilter) => void })`
  - `FairnessStats({ legs, spread })`, `LegBars({ legs, mine })`
  - `HubCard({ rec, rank, expanded, onToggle, best, mine, href })`. 루트 요소에 `data-testid="hub-card"`, 요약 줄에 `data-testid="hub-summary"` (형식: `"{지역}, 최대 약 N분, 차이 N분"`)
  - `ResultScreen({ slug, filter, onFilterChange, onAddPeople })`
  - 경로 `/r/[slug]/result`. 필터는 URL 쿼리 `?region=...&theme=...`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/components/result/FilterBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { FilterBar } from "./FilterBar";

const ALL = ["서울", "경기", "인천"];

test("URL에 필터가 없으면 적용된 값(방 기본값)을 켜진 상태로 보여준다", () => {
  render(
    <FilterBar filter={{ regions: null, theme: null }} appliedRegions={["서울", "경기"]} appliedTheme="cafe" onChange={vi.fn()} />,
  );
  expect(screen.getByRole("button", { name: "서울" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "인천" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "카페" })).toHaveAttribute("aria-pressed", "true");
});

test("지역을 끄면 남은 지역을 넘기고 테마는 건드리지 않는다", async () => {
  const onChange = vi.fn();
  render(<FilterBar filter={{ regions: null, theme: null }} appliedRegions={ALL} appliedTheme={null} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "경기" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: ["서울", "인천"], theme: null });
});

test("URL 필터가 적용된 값보다 우선한다 (응답이 오기 전에 연달아 눌러도 맞게)", async () => {
  const onChange = vi.fn();
  render(
    <FilterBar filter={{ regions: ["서울", "인천"], theme: null }} appliedRegions={ALL} appliedTheme={null} onChange={onChange} />,
  );
  expect(screen.getByRole("button", { name: "경기" })).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(screen.getByRole("button", { name: "인천" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: ["서울"], theme: null });
});

test("테마를 고르면 그 테마, 켜진 테마를 다시 누르면 any", async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <FilterBar filter={{ regions: null, theme: null }} appliedRegions={ALL} appliedTheme={null} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: null, theme: "cafe" });
  rerender(
    <FilterBar filter={{ regions: null, theme: null }} appliedRegions={ALL} appliedTheme="cafe" onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: null, theme: "any" });
});

test("URL이 any면 방 테마가 있어도 꺼진 상태", () => {
  render(<FilterBar filter={{ regions: null, theme: "any" }} appliedRegions={ALL} appliedTheme={null} onChange={vi.fn()} />);
  for (const label of ["맛집", "카페", "술자리", "놀거리"]) {
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "false");
  }
});
```

`frontend/components/result/LegBars.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { leg } from "@/lib/test/fixtures";
import { LegBars } from "./LegBars";

const LEGS = [
  leg({ participant_id: 1, nickname: "민수", minutes: 11, origin_station_name: "강남" }),
  leg({ participant_id: 2, nickname: "수진", minutes: 22, origin_station_name: "신림", via: "bus" }),
];

test("가장 오래 걸리는 사람만 강조하고 막대 길이는 비율대로", () => {
  render(<LegBars legs={LEGS} mine={[1]} />);
  const bars = screen.getAllByTestId("leg-bar");
  expect(bars[0]).toHaveStyle({ width: "50%" });
  expect(bars[1]).toHaveStyle({ width: "100%" });
  expect(bars[0]).toHaveClass("bg-primary-soft");
  expect(bars[1]).toHaveClass("bg-accent");
  expect(screen.getByText("약 22분")).toHaveClass("text-accent");
});

test("내가 넣은 사람과 버스 구간을 표시한다", () => {
  render(<LegBars legs={LEGS} mine={[1]} />);
  expect(screen.getByText("나")).toBeInTheDocument();
  expect(screen.getByText("신림, 버스 15분 포함")).toBeInTheDocument();
});
```

`frontend/components/result/ResultScreen.test.tsx`:

```tsx
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";
import type { ResultOut } from "@/lib/api/types";
import { NO_FILTER } from "@/lib/filter";
import { API, leg, rec, result } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { ResultScreen } from "./ResultScreen";

function serve(body: ResultOut) {
  server.use(http.get(`${API}/rooms/abc123/result`, () => HttpResponse.json(body)));
}

function show(props: Partial<Parameters<typeof ResultScreen>[0]> = {}) {
  return renderWithClient(
    <ResultScreen slug="abc123" filter={NO_FILTER} onFilterChange={vi.fn()} onAddPeople={vi.fn()} {...props} />,
  );
}

const TWO_HUBS = [
  rec({ hub_id: 1, name: "양재" }),
  rec({ hub_id: 2, name: "교대", region: "서울", max_minutes: 25, spread_minutes: 12, lines: ["2호선", "3호선"] }),
];

test("1위 카드가 펼쳐진 채로 시작하고 다른 카드를 누르면 그 카드가 펼쳐진다", async () => {
  serve(result({ recommendations: TWO_HUBS }));
  show();
  expect(screen.getByText("불러오는 중이에요")).toBeInTheDocument();
  const cards = await screen.findAllByTestId("hub-card");
  expect(cards).toHaveLength(2);
  expect(within(cards[0]).getByRole("button", { expanded: true })).toBeInTheDocument();
  expect(within(cards[0]).getByText("1위")).toBeInTheDocument();
  expect(within(cards[1]).getByRole("button", { expanded: false })).toBeInTheDocument();
  expect(within(cards[1]).getByTestId("hub-summary")).toHaveTextContent("서울, 최대 약 25분, 차이 12분");

  await userEvent.click(within(cards[1]).getByRole("button", { expanded: false }));
  expect(within(cards[1]).getByRole("button", { expanded: true })).toBeInTheDocument();
  expect(within(cards[0]).getByRole("button", { expanded: false })).toBeInTheDocument();
});

test("펼친 카드는 수치, 사람별 시간, 둘러보기 링크를 보여준다", async () => {
  serve(result({ recommendations: TWO_HUBS }));
  show({ filter: { regions: ["서울"], theme: "cafe" } });
  const card = (await screen.findAllByTestId("hub-card"))[0];
  expect(within(card).getByText("어디서든 오기 쉬운 교통 중심")).toBeInTheDocument();
  expect(within(card).getByText("평균")).toBeInTheDocument();
  expect(within(card).getByText("약 17분")).toBeInTheDocument();
  expect(within(card).getByRole("link", { name: "이 동네 둘러보기" })).toHaveAttribute(
    "href",
    "/r/abc123/hubs/1?region=%EC%84%9C%EC%9A%B8&theme=cafe",
  );
});

test("테마 도장과 가장 빠른 곳보다 얼마나 더 걸리는지 보여준다", async () => {
  serve(
    result({
      theme: "cafe",
      best_max_minutes: 22,
      recommendations: [rec({ hub_id: 2, name: "교대", max_minutes: 25, theme_match: true }), rec({ hub_id: 1 })],
    }),
  );
  show();
  const card = (await screen.findAllByTestId("hub-card"))[0];
  expect(within(card).getByText("테마에 맞아요")).toBeInTheDocument();
  expect(within(card).getByText("가장 빠른 곳보다 3분 더")).toBeInTheDocument();
});

test("대기 상태면 초대 안내와 사람 추가", async () => {
  serve(result({ status: "waiting", recommendations: [], best_max_minutes: null }));
  const onAddPeople = vi.fn();
  show({ onAddPeople });
  expect(await screen.findByText("친구를 초대하세요. 두 명부터 추천이 나와요.")).toBeInTheDocument();
  expect(screen.queryByTestId("hub-card")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "사람 추가" }));
  expect(onAddPeople).toHaveBeenCalledOnce();
});

test("지역을 좁혀서 추천이 없으면 지역을 넓히라고 안내한다", async () => {
  serve(result({ recommendations: [], best_max_minutes: null, regions: ["인천"] }));
  show({ filter: { regions: ["인천"], theme: null } });
  expect(await screen.findByText("이 지역엔 추천할 곳이 없어요. 지역을 넓혀보세요.")).toBeInTheDocument();
  // 필터는 그대로 보여서 다시 넓힐 수 있어야 한다
  expect(screen.getByRole("button", { name: "서울" })).toBeInTheDocument();
});

test("전체 지역인데 추천이 없으면 계산 실패 안내", async () => {
  serve(result({ recommendations: [], best_max_minutes: null }));
  show();
  expect(await screen.findByText("경로를 계산하지 못했어요. 방을 새로 만들어 다시 시도해주세요.")).toBeInTheDocument();
});

test("이동시간이 빠진 카드는 안내 문구로 대신한다", async () => {
  serve(result({ recommendations: [rec({ legs: [] })] }));
  show();
  const card = (await screen.findAllByTestId("hub-card"))[0];
  expect(within(card).getByText("이동시간을 불러오지 못했어요")).toBeInTheDocument();
  expect(within(card).queryByTestId("leg-bar")).toBeNull();
});

test("내가 넣은 사람에게 '나'를 붙인다", async () => {
  window.localStorage.setItem("wjm:room:abc123:mine", "[2]");
  serve(result({ recommendations: [rec({ legs: [leg(), leg({ participant_id: 2, nickname: "수진", minutes: 22 })] })] }));
  show();
  await screen.findAllByTestId("hub-card");
  expect(screen.getByText("나")).toBeInTheDocument();
});

test("필터 칩을 누르면 바뀐 필터를 넘긴다", async () => {
  serve(result({ recommendations: TWO_HUBS }));
  const onFilterChange = vi.fn();
  show({ onFilterChange });
  await screen.findAllByTestId("hub-card");
  await userEvent.click(screen.getByRole("button", { name: "경기" }));
  expect(onFilterChange).toHaveBeenLastCalledWith({ regions: ["서울", "인천"], theme: null });
});

test("만료된 방이면 백엔드 문구와 새 방 만들기", async () => {
  server.use(
    http.get(`${API}/rooms/abc123/result`, () => HttpResponse.json({ detail: "약속이 지난 방이에요" }, { status: 410 })),
  );
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent("약속이 지난 방이에요");
  expect(screen.getByRole("link", { name: "새 방 만들기" })).toHaveAttribute("href", "/");
});

test("결과 링크 복사는 필터가 붙은 주소를 복사한다", async () => {
  serve(result({ recommendations: TWO_HUBS }));
  const user = userEvent.setup();
  show({ filter: { regions: null, theme: "cafe" } });
  await screen.findAllByTestId("hub-card");
  await user.click(screen.getByRole("button", { name: "결과 링크 복사" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("링크를 복사했어요"));
  expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/r/abc123/result?theme=cafe`);
});
```

Run: `cd frontend && npm test -- components/result`
Expected: FAIL, 모듈을 찾지 못함

- [ ] **Step 2: 구현 (작은 컴포넌트)**

`frontend/components/result/FilterBar.tsx`:

```tsx
import { RegionChips } from "@/components/room/RegionChips";
import { Chip } from "@/components/ui/Chip";
import type { ResultFilter } from "@/lib/filter";
import { parseRegions } from "@/lib/regions";
import { THEME_OFF, THEMES } from "@/lib/themes";

type Props = {
  filter: ResultFilter;
  appliedRegions: readonly string[];
  appliedTheme: string | null;
  onChange: (next: ResultFilter) => void;
};

export function FilterBar({ filter, appliedRegions, appliedTheme, onChange }: Props) {
  // URL에 적힌 값이 있으면 그것이 기준이다. 응답이 오기 전에 연달아 눌러도 어긋나지 않는다.
  const regions = filter.regions ?? parseRegions(appliedRegions);
  const theme = filter.theme === THEME_OFF ? null : (filter.theme ?? appliedTheme);
  return (
    <section aria-label="추천 조건" className="space-y-2">
      <RegionChips value={regions} onChange={(next) => onChange({ ...filter, regions: next })} />
      <div role="group" aria-label="테마" className="flex flex-wrap gap-2">
        {THEMES.map((item) => (
          <Chip
            key={item.id}
            selected={theme === item.id}
            onClick={() => onChange({ ...filter, theme: theme === item.id ? THEME_OFF : item.id })}
          >
            {item.label}
          </Chip>
        ))}
      </div>
    </section>
  );
}
```

`frontend/components/result/FairnessStats.tsx`:

```tsx
import type { LegOut } from "@/lib/api/types";
import { aboutMinutes, average } from "@/lib/format";

export function FairnessStats({ legs, spread }: { legs: readonly LegOut[]; spread: number }) {
  const minutes = legs.map((leg) => leg.minutes);
  const stats = [
    { label: "가장 오래", value: aboutMinutes(Math.max(...minutes)), strong: true },
    { label: "평균", value: aboutMinutes(average(minutes)), strong: false },
    { label: "차이", value: `${spread}분`, strong: false },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg bg-track p-2.5">
          <dt className="text-xs text-ink-mute">{stat.label}</dt>
          <dd className={`font-bold ${stat.strong ? "text-accent" : ""}`}>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

`frontend/components/result/LegBars.tsx`:

```tsx
import type { LegOut } from "@/lib/api/types";
import { aboutMinutes } from "@/lib/format";
import { MSG_BUS } from "@/lib/messages";

const MIN_BAR_PERCENT = 8;

export function LegBars({ legs, mine }: { legs: readonly LegOut[]; mine: readonly number[] }) {
  const longest = Math.max(...legs.map((leg) => leg.minutes), 1);
  return (
    <ul className="space-y-2.5">
      {legs.map((leg) => {
        const slowest = leg.minutes === longest;
        const width = Math.max(MIN_BAR_PERCENT, Math.round((leg.minutes / longest) * 100));
        const origin = `${leg.origin_station_name}${leg.via === "bus" ? `, ${MSG_BUS}` : ""}`;
        return (
          <li key={leg.participant_id} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className={`truncate font-semibold ${slowest ? "text-accent" : ""}`}>{leg.nickname}</span>
                {mine.includes(leg.participant_id) && <span className="text-xs font-bold text-primary">나</span>}
                <span className="truncate text-ink-mute">{origin}</span>
              </span>
              <span className={`shrink-0 font-bold ${slowest ? "text-accent" : ""}`}>{aboutMinutes(leg.minutes)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-track">
              <div
                data-testid="leg-bar"
                style={{ width: `${width}%` }}
                className={`h-full rounded-full ${slowest ? "bg-accent" : "bg-primary-soft"}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
```

`frontend/components/result/HubCard.tsx`:

```tsx
import Link from "next/link";
import { LineBadge } from "@/components/ui/LineBadge";
import { Stamp } from "@/components/ui/Stamp";
import { CARD, PRIMARY_BUTTON } from "@/components/ui/styles";
import type { RecommendationOut } from "@/lib/api/types";
import { aboutMinutes } from "@/lib/format";
import { MSG_LEGS_MISSING, MSG_THEME_MATCH, msgSlowerThanBest } from "@/lib/messages";
import { FairnessStats } from "./FairnessStats";
import { LegBars } from "./LegBars";

type Props = {
  rec: RecommendationOut;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  best: number | null;
  mine: readonly number[];
  href: string;
};

export function HubCard({ rec, rank, expanded, onToggle, best, mine, href }: Props) {
  const extra = best === null ? 0 : rec.max_minutes - best;
  return (
    <article data-testid="hub-card" className={`${CARD} ${expanded ? "border-primary" : ""}`}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {rank}
            </span>
            <span className="text-lg font-extrabold tracking-tight">{rec.name}</span>
            {rec.lines.map((line) => (
              <LineBadge key={line} line={line} />
            ))}
          </span>
          <span data-testid="hub-summary" className="mt-1 block text-sm text-ink-sub">
            {rec.region}, 최대 {aboutMinutes(rec.max_minutes)}, 차이 {rec.spread_minutes}분
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {rank === 1 && <Stamp>1위</Stamp>}
          {rec.theme_match && <Stamp>{MSG_THEME_MATCH}</Stamp>}
        </span>
      </button>
      {expanded && (
        <div className="mt-4 space-y-4">
          {rec.tags.length > 0 && (
            <p className="flex flex-wrap gap-1.5 text-xs">
              {rec.tags.map((tag) => (
                <span key={tag} className="rounded bg-track px-1.5 py-0.5 text-ink-sub">
                  {tag}
                </span>
              ))}
            </p>
          )}
          {rec.vibe_summary && <p className="text-sm text-ink-sub">{rec.vibe_summary}</p>}
          {extra > 0 && <p className="text-sm font-semibold text-accent">{msgSlowerThanBest(extra)}</p>}
          {rec.legs.length === 0 ? (
            <p className="text-sm text-ink-mute">{MSG_LEGS_MISSING}</p>
          ) : (
            <>
              <FairnessStats legs={rec.legs} spread={rec.spread_minutes} />
              <LegBars legs={rec.legs} mine={mine} />
            </>
          )}
          <Link href={href} className={PRIMARY_BUTTON}>
            이 동네 둘러보기
          </Link>
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 3: 구현 (`ResultScreen`)**

`frontend/components/result/ResultScreen.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { ShareButtons } from "@/components/join/ShareButtons";
import { StickyAction } from "@/components/ui/StickyAction";
import { useToast } from "@/components/ui/Toast";
import { CARD, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { useResult } from "@/lib/api/hooks";
import { SERVICE_NAME } from "@/lib/constants";
import { filterQuery, type ResultFilter } from "@/lib/filter";
import {
  MSG_LINK_COPIED,
  MSG_LINK_COPY_FAILED,
  MSG_LOADING,
  MSG_NEED_TWO,
  MSG_NO_HUB_IN_REGION,
  MSG_NO_ROUTE,
} from "@/lib/messages";
import { readMine } from "@/lib/myParticipants";
import { isAllRegions } from "@/lib/regions";
import { copyText } from "@/lib/share";
import { FilterBar } from "./FilterBar";
import { HubCard } from "./HubCard";

type Props = {
  slug: string;
  filter: ResultFilter;
  onFilterChange: (next: ResultFilter) => void;
  onAddPeople: () => void;
};

export function ResultScreen({ slug, filter, onFilterChange, onAddPeople }: Props) {
  const result = useResult(slug, filter);
  const [openId, setOpenId] = useState<number | null>(null);
  const [mine] = useState(() => readMine(slug));
  const toast = useToast();

  if (!result.data) {
    if (result.error) {
      return (
        <section role="alert" className={`${CARD} space-y-4 text-center`}>
          <p className="font-semibold">{result.error.message}</p>
          <Link href="/" className={PRIMARY_BUTTON}>
            새 방 만들기
          </Link>
        </section>
      );
    }
    return <p className="py-10 text-center text-ink-mute">{MSG_LOADING}</p>;
  }

  const data = result.data;
  if (data.status === "waiting") {
    return (
      <section className={`${CARD} space-y-4 text-center`}>
        <p className="font-bold">{MSG_NEED_TWO}</p>
        <ShareButtons slug={slug} title={SERVICE_NAME} />
        <button type="button" onClick={onAddPeople} className={PRIMARY_BUTTON}>
          사람 추가
        </button>
      </section>
    );
  }

  const recs = data.recommendations;
  const query = filterQuery(filter);
  // 고른 카드가 목록에서 사라졌으면(필터 변경, 폴링) 1위 카드를 펼친다.
  const open = recs.some((rec) => rec.hub_id === openId) ? openId : (recs[0]?.hub_id ?? null);
  const copyLink = async () => {
    const url = `${window.location.origin}/r/${slug}/result${query}`;
    toast((await copyText(url)) ? MSG_LINK_COPIED : MSG_LINK_COPY_FAILED);
  };

  return (
    <div className="space-y-4">
      <FilterBar filter={filter} appliedRegions={data.regions} appliedTheme={data.theme} onChange={onFilterChange} />
      {recs.length === 0 ? (
        <p className={`${CARD} text-center font-semibold`}>
          {isAllRegions(data.regions) ? MSG_NO_ROUTE : MSG_NO_HUB_IN_REGION}
        </p>
      ) : (
        <ol className="space-y-3">
          {recs.map((rec, index) => (
            <li key={rec.hub_id}>
              <HubCard
                rec={rec}
                rank={index + 1}
                expanded={rec.hub_id === open}
                onToggle={() => setOpenId(rec.hub_id)}
                best={data.best_max_minutes}
                mine={mine}
                href={`/r/${slug}/hubs/${rec.hub_id}${query}`}
              />
            </li>
          ))}
        </ol>
      )}
      <StickyAction>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onAddPeople} className={SECONDARY_BUTTON}>
            사람 추가
          </button>
          <button type="button" onClick={copyLink} className={SECONDARY_BUTTON}>
            결과 링크 복사
          </button>
        </div>
      </StickyAction>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npm test -- components/result`
Expected: 18 passed (FilterBar 5, LegBars 2, ResultScreen 11)

- [ ] **Step 5: 경로 연결**

`frontend/app/r/[slug]/result/page.tsx`:

```tsx
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ResultScreen } from "@/components/result/ResultScreen";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { filterFromSearch, filterQuery } from "@/lib/filter";

function ResultPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const filter = filterFromSearch(new URLSearchParams(useSearchParams().toString()));

  return (
    <main>
      <StepIndicator current={3} slug={slug} />
      <ResultScreen
        slug={slug}
        filter={filter}
        // 필터는 보는 사람 화면에서만 바뀐다. 방 설정은 건드리지 않고 URL만 바꾼다.
        onFilterChange={(next) => router.replace(`/r/${slug}/result${filterQuery(next)}`, { scroll: false })}
        onAddPeople={() => router.push(`/r/${slug}?add=1`)}
      />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResultPage />
    </Suspense>
  );
}
```

- [ ] **Step 6: 브라우저 확인**

방을 만들고 2호선 홍대입구, 수원, 잠실을 넣은 뒤 "추천 보기":
- 카드 5장, 1위가 펼쳐져 있고 "1위" 도장, 노선 뱃지, 사람별 막대(가장 오래 걸리는 사람만 빨강)
- 지역에서 경기와 인천을 끄면 주소가 `?region=서울`로 바뀌고 목록이 바뀐다 (1위 가락시장, 약 54분). 새로고침해도 유지된다
- 테마 "카페"를 켜면 주소에 `theme=cafe`, 맞는 카드에 "테마에 맞아요" 도장. 다시 누르면 `theme=any`
- "사람 추가"를 누르면 참여 화면으로 가고 다시 추천으로 튕기지 않는다
- 참여 화면에서 한 명만 남기고 빼면 추천 화면이 초대 안내로 바뀐다
- 다른 브라우저(또는 시크릿 창)에서 사람을 넣으면 10초 안에 추천이 바뀐다

스크린샷(모바일 폭 375)을 찍어 사용자에게 보여준다.

- [ ] **Step 7: 커밋**

Run: `cd frontend && npm test && npm run lint && npx tsc --noEmit && npm run build`
Expected: 전부 통과

```bash
git add frontend/components/result "frontend/app/r/[slug]/result"
git commit -m "feat: recommendation screen with region and theme filters"
```

---

## Task 15: 카카오 지도

**Files:**
- Create: `frontend/components/map/KakaoMap.tsx`, `frontend/types/kakao.d.ts`
- Modify: `frontend/components/result/ResultScreen.tsx`
- Test: `frontend/components/map/KakaoMap.test.tsx`

**Interfaces:**
- Consumes: `react-kakao-maps-sdk`의 `Map`, `CustomOverlayMap`, `useKakaoLoader`. 환경 변수 `NEXT_PUBLIC_KAKAO_JS_KEY`.
- Produces:
  - `type MapPin = { id: string; lat: number; lng: number; label: string }`
  - `KakaoMap({ pins: readonly MapPin[], activeId: string | null, center?: { lat: number; lng: number }, level?: number })`. 키가 없거나 SDK 로드에 실패하면 `null`을 그린다. `center`가 없으면 모든 핀이 보이게 맞춘다.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/components/map/KakaoMap.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useKakaoLoader } from "react-kakao-maps-sdk";
import { KakaoMap } from "./KakaoMap";

vi.mock("react-kakao-maps-sdk", () => ({
  useKakaoLoader: vi.fn(),
  Map: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  CustomOverlayMap: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const PINS = [
  { id: "1", lat: 37.48, lng: 127.03, label: "1" },
  { id: "2", lat: 37.49, lng: 127.01, label: "2" },
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(useKakaoLoader).mockReset();
});

test("키가 없으면 아무것도 그리지 않고 SDK도 부르지 않는다", () => {
  vi.stubEnv("NEXT_PUBLIC_KAKAO_JS_KEY", "");
  const { container } = render(<KakaoMap pins={PINS} activeId={null} />);
  expect(container).toBeEmptyDOMElement();
  expect(useKakaoLoader).not.toHaveBeenCalled();
});

test("불러오는 동안에는 자리만 잡아둔다", () => {
  vi.stubEnv("NEXT_PUBLIC_KAKAO_JS_KEY", "test-key");
  vi.mocked(useKakaoLoader).mockReturnValue([true, undefined]);
  const { container, queryByTestId } = render(<KakaoMap pins={PINS} activeId={null} />);
  expect(container.firstChild).toHaveClass("bg-track");
  expect(queryByTestId("map")).toBeNull();
});

test("SDK 로드에 실패하면 지도 자리를 접는다", () => {
  vi.stubEnv("NEXT_PUBLIC_KAKAO_JS_KEY", "test-key");
  vi.mocked(useKakaoLoader).mockReturnValue([false, new ErrorEvent("error")]);
  const { container } = render(<KakaoMap pins={PINS} activeId={null} />);
  expect(container).toBeEmptyDOMElement();
});

test("핀마다 번호를 그리고 고른 핀을 강조한다", () => {
  vi.stubEnv("NEXT_PUBLIC_KAKAO_JS_KEY", "test-key");
  vi.mocked(useKakaoLoader).mockReturnValue([false, undefined]);
  const { getByText } = render(<KakaoMap pins={PINS} activeId="2" center={{ lat: 37.48, lng: 127.03 }} />);
  expect(getByText("1")).toHaveClass("bg-primary");
  expect(getByText("2")).toHaveClass("bg-accent");
});
```

Run: `cd frontend && npm test -- components/map`
Expected: FAIL, 모듈을 찾지 못함

- [ ] **Step 2: 구현**

`frontend/types/kakao.d.ts` (전역 `kakao` 타입을 불러온다):

```ts
/// <reference types="kakao.maps.d.ts" />
```

`frontend/components/map/KakaoMap.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { CustomOverlayMap, Map, useKakaoLoader } from "react-kakao-maps-sdk";

export type MapPin = { id: string; lat: number; lng: number; label: string };

type Props = {
  pins: readonly MapPin[];
  activeId: string | null;
  center?: { lat: number; lng: number };
  level?: number;
};

const FRAME = "h-56 w-full overflow-hidden rounded-card border border-line";

export function KakaoMap(props: Props) {
  const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
  // 키가 없으면 지도 자리를 접는다. 나머지 화면은 그대로 동작한다.
  if (!appkey) return null;
  return <LoadedMap appkey={appkey} {...props} />;
}

function LoadedMap({ appkey, pins, activeId, center, level = 5 }: Props & { appkey: string }) {
  const [loading, error] = useKakaoLoader({ appkey });
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  // 폴링으로 배열이 새로 만들어져도 좌표가 같으면 다시 맞추지 않게 문자열로 비교한다.
  const pinKey = pins.map((pin) => `${pin.id}:${pin.lat}:${pin.lng}`).join("|");

  useEffect(() => {
    // 중심을 주지 않았으면 모든 핀이 보이게 범위를 맞춘다.
    if (!map || center || pins.length === 0) return;
    const bounds = new kakao.maps.LatLngBounds();
    for (const pin of pins) bounds.extend(new kakao.maps.LatLng(pin.lat, pin.lng));
    map.setBounds(bounds);
    // pins 대신 pinKey로 비교한다 (위 주석 참고).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, center, pinKey]);

  if (error) return null;
  const start = center ?? pins[0];
  if (loading || !start) return <div aria-hidden className={`${FRAME} bg-track`} />;

  return (
    <Map center={{ lat: start.lat, lng: start.lng }} level={level} onCreate={setMap} className={FRAME}>
      {pins.map((pin) => {
        const active = pin.id === activeId;
        return (
          <CustomOverlayMap key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} zIndex={active ? 2 : 1}>
            <span
              className={`flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-card px-1.5 text-xs font-bold text-white ${active ? "bg-accent" : "bg-primary"}`}
            >
              {pin.label}
            </span>
          </CustomOverlayMap>
        );
      })}
    </Map>
  );
}
```

Run: `cd frontend && npm test -- components/map`
Expected: 4 passed

- [ ] **Step 3: 추천 화면에 지도 넣기**

`frontend/components/result/ResultScreen.tsx`에 `import { KakaoMap } from "@/components/map/KakaoMap";`를 추가한다. `FilterBar` 바로 아래, 추천이 있을 때만 지도를 그린다. `recs.length === 0 ? (...) : (...)`의 뒤쪽 가지를 프래그먼트로 감싼다.

```tsx
        <>
          <KakaoMap
            pins={recs.map((rec, index) => ({
              id: String(rec.hub_id),
              lat: rec.lat,
              lng: rec.lng,
              label: String(index + 1),
            }))}
            activeId={open === null ? null : String(open)}
          />
          <ol className="space-y-3">
            {recs.map((rec, index) => (
              <li key={rec.hub_id}>
                <HubCard
                  rec={rec}
                  rank={index + 1}
                  expanded={rec.hub_id === open}
                  onToggle={() => setOpenId(rec.hub_id)}
                  best={data.best_max_minutes}
                  mine={mine}
                  href={`/r/${slug}/hubs/${rec.hub_id}${query}`}
                />
              </li>
            ))}
          </ol>
        </>
```

Run: `cd frontend && npm test`
Expected: 전부 passed (테스트 환경에는 키가 없어 지도는 그려지지 않는다)

- [ ] **Step 4: 카카오 JS 키 설정 (사용자 작업)**

사용자에게 아래를 요청한다. 키가 없어도 다음 태스크로 넘어갈 수 있고, 이 경우 지도 확인만 미뤄둔다.

1. https://developers.kakao.com 의 내 애플리케이션에서 JavaScript 키를 복사한다 (REST 키와 같은 앱).
2. 같은 앱의 플랫폼 설정에서 Web 사이트 도메인에 `http://localhost:3000`을 추가한다.
3. `frontend/.env.local`의 `NEXT_PUBLIC_KAKAO_JS_KEY=` 뒤에 키를 붙여넣고 프론트 개발 서버를 다시 띄운다.

파일은 Claude가 메모장으로 열어준다: `start "" notepad "C:\Users\eldorado\Projects\우리지금만나\frontend\.env.local"`

- [ ] **Step 5: 브라우저 확인**

키가 있으면: 추천 화면 필터 아래에 지도가 뜨고 번호 핀 5개가 전부 보인다. 다른 카드를 펼치면 그 번호 핀이 빨갛게 바뀐다.
키가 없으면: 지도 자리가 없고 나머지는 그대로다. 콘솔에 에러가 없다.

- [ ] **Step 6: 커밋**

Run: `cd frontend && npm run lint && npx tsc --noEmit`
Expected: 에러 없음

```bash
git add frontend/components/map frontend/types frontend/components/result/ResultScreen.tsx
git commit -m "feat: kakao map with numbered hub pins on the recommendation screen"
```

---

## Task 16: 화면 4.4 거점 주변

**Files:**
- Create: `frontend/components/hub/HubHeader.tsx`, `PlaceCard.tsx`, `EventCard.tsx`, `ContentTabs.tsx`, `HubScreen.tsx`
- Create: `frontend/app/r/[slug]/hubs/[hubId]/page.tsx`
- Test: `frontend/components/hub/HubScreen.test.tsx`

**Interfaces:**
- Consumes: `useResult(slug, filter, { poll: false })`, `useHubContent(slug, hubId, kind)` (Task 10), `Place`, `EventItem` 타입, `CONTENT_TABS`, `firstTab`, `walkMinutes`, 문구 상수 (Task 9), `LineBadge`, `styles.ts`, `useToast` (Task 11), `KakaoMap` (Task 15).
- Produces:
  - `HubHeader({ rec })`, `PlaceCard({ place, index, active, onSelect })`, `EventCard({ event })`
  - `ContentTabs({ slug, hubId, initial: ContentKind, center, onGone })`
  - `HubScreen({ slug, hubId: number, filter, onGone: () => void })`. 거점이 추천 목록에 없거나 콘텐츠 API가 404면 `onGone`을 한 번만 부른다.
  - 경로 `/r/[slug]/hubs/[hubId]`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/components/hub/HubScreen.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";
import { NO_FILTER } from "@/lib/filter";
import { API, rec, result } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { HubScreen } from "./HubScreen";

const PLACE = {
  id: "100",
  name: "양재 국밥집",
  category: "국밥",
  address: "서울 서초구 강남대로 1",
  distance_m: 210,
  url: "https://place.map.kakao.com/100",
  lat: 37.485,
  lng: 127.035,
};
const EVENT = {
  id: "e1",
  title: "양재천 봄 음악회",
  place: "양재천 야외무대",
  start_date: "2026-10-09",
  end_date: "2026-10-11",
  lat: 37.48,
  lng: 127.04,
  url: "https://example.org/e1",
  image: "",
  category: "음악",
  is_free: true,
  distance_m: 600,
};

function serveResult(theme: string | null = null) {
  server.use(http.get(`${API}/rooms/abc123/result`, () => HttpResponse.json(result({ theme, recommendations: [rec()] }))));
}

function serveContent(handler: (kind: string) => Response) {
  const kinds: string[] = [];
  server.use(
    http.get(`${API}/rooms/abc123/hubs/1/content`, ({ request }) => {
      const kind = new URL(request.url).searchParams.get("kind") ?? "";
      kinds.push(kind);
      return handler(kind);
    }),
  );
  return kinds;
}

function show(onGone = vi.fn(), hubId = 1) {
  renderWithClient(<HubScreen slug="abc123" hubId={hubId} filter={NO_FILTER} onGone={onGone} />);
  return onGone;
}

test("거점 정보와 테마에 맞는 탭의 장소를 보여준다", async () => {
  serveResult("cafe");
  const kinds = serveContent((kind) => HttpResponse.json({ kind, items: [PLACE], error: null }));
  show();
  expect(await screen.findByRole("heading", { name: "양재" })).toBeInTheDocument();
  expect(screen.getByText("반경 600m")).toBeInTheDocument();
  expect(await screen.findByText("양재 국밥집")).toBeInTheDocument();
  expect(kinds).toEqual(["cafe"]);
  expect(screen.getByRole("tab", { name: "카페" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("도보 약 4분")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "카카오맵에서 보기" })).toHaveAttribute("href", PLACE.url);
});

test("테마가 없으면 맛집 탭부터, 탭을 바꾸면 그 종류를 한 번 불러온다", async () => {
  serveResult();
  const kinds = serveContent((kind) =>
    HttpResponse.json({ kind, items: kind === "event" ? [EVENT] : [PLACE], error: null }),
  );
  show();
  await screen.findByText("양재 국밥집");
  await userEvent.click(screen.getByRole("tab", { name: "행사" }));
  expect(await screen.findByText("양재천 봄 음악회")).toBeInTheDocument();
  expect(screen.getByText("무료")).toBeInTheDocument();
  expect(screen.getByText("2026-10-09 ~ 2026-10-11")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "맛집" }));
  await screen.findByText("양재 국밥집");
  expect(kinds).toEqual(["food", "event"]);
});

test("에러 문구와 묵은 목록이 같이 오면 둘 다 보여준다", async () => {
  serveResult();
  serveContent((kind) => HttpResponse.json({ kind, items: [PLACE], error: "지금 불러올 수 없어요" }));
  show();
  expect(await screen.findByText("지금 불러올 수 없어요")).toBeInTheDocument();
  expect(screen.getByText("양재 국밥집")).toBeInTheDocument();
});

test("에러만 오면 문구만 보여준다", async () => {
  serveResult();
  serveContent((kind) => HttpResponse.json({ kind, items: [], error: "지금 불러올 수 없어요" }));
  show();
  expect(await screen.findByText("지금 불러올 수 없어요")).toBeInTheDocument();
  expect(screen.queryByText("근처에서 찾지 못했어요")).toBeNull();
});

test("결과가 없으면 못 찾았다고 알린다", async () => {
  serveResult();
  serveContent((kind) => HttpResponse.json({ kind, items: [], error: null }));
  show();
  expect(await screen.findByText("근처에서 찾지 못했어요")).toBeInTheDocument();
});

test("추천 목록에 없는 거점이면 onGone을 한 번 부른다", async () => {
  serveResult();
  const onGone = show(vi.fn(), 999);
  await waitFor(() => expect(onGone).toHaveBeenCalledOnce());
});

test("콘텐츠 API가 404면 onGone을 부른다", async () => {
  serveResult();
  serveContent(() => HttpResponse.json({ detail: "거점을 찾을 수 없어요" }, { status: 404 }));
  const onGone = show();
  await waitFor(() => expect(onGone).toHaveBeenCalledOnce());
});
```

Run: `cd frontend && npm test -- components/hub`
Expected: FAIL, 모듈을 찾지 못함

- [ ] **Step 2: 구현 (표시 컴포넌트)**

`frontend/components/hub/HubHeader.tsx`:

```tsx
import { LineBadge } from "@/components/ui/LineBadge";
import { CARD } from "@/components/ui/styles";
import type { RecommendationOut } from "@/lib/api/types";

export function HubHeader({ rec }: { rec: RecommendationOut }) {
  return (
    <section className={`${CARD} space-y-2`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <h1 className="text-xl font-extrabold tracking-tight">{rec.name}</h1>
        {rec.lines.map((line) => (
          <LineBadge key={line} line={line} />
        ))}
      </div>
      {rec.vibe_summary && <p className="text-sm text-ink-sub">{rec.vibe_summary}</p>}
      <p className="flex flex-wrap gap-1.5 text-xs">
        <span className="rounded bg-primary-tint px-1.5 py-0.5 font-semibold text-primary">{rec.region}</span>
        <span className="rounded bg-primary-tint px-1.5 py-0.5 font-semibold text-primary">반경 600m</span>
        {rec.tags.map((tag) => (
          <span key={tag} className="rounded bg-track px-1.5 py-0.5 text-ink-sub">
            {tag}
          </span>
        ))}
      </p>
    </section>
  );
}
```

`frontend/components/hub/PlaceCard.tsx`:

```tsx
import { CARD } from "@/components/ui/styles";
import type { Place } from "@/lib/api/types";
import { walkMinutes } from "@/lib/format";

type Props = { place: Place; index: number; active: boolean; onSelect: () => void };

export function PlaceCard({ place, index, active, onSelect }: Props) {
  return (
    <article className={`${CARD} ${active ? "border-primary" : ""}`}>
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 text-left">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          {index + 1}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-bold">{place.name}</span>
          <span className="block text-sm text-ink-sub">
            {place.category ? `${place.category}, ` : ""}
            <span className="font-semibold text-primary">도보 약 {walkMinutes(place.distance_m)}분</span>
          </span>
          <span className="block truncate text-sm text-ink-mute">{place.address}</span>
        </span>
      </button>
      <a
        href={place.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm font-semibold text-primary underline"
      >
        카카오맵에서 보기
      </a>
    </article>
  );
}
```

`frontend/components/hub/EventCard.tsx`:

```tsx
import { CARD } from "@/components/ui/styles";
import type { EventItem } from "@/lib/api/types";

export function EventCard({ event }: { event: EventItem }) {
  return (
    <article className={`${CARD} flex gap-3`}>
      {event.image && (
        // 포스터는 외부 주소라 next/image 대신 img를 쓴다 (허용 도메인을 미리 알 수 없다).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.image} alt="" loading="lazy" className="h-24 w-[72px] shrink-0 rounded-lg object-cover" />
      )}
      <div className="min-w-0 space-y-1">
        <p className="font-bold">{event.title}</p>
        <p className="truncate text-sm text-ink-sub">{event.place}</p>
        <p className="text-sm text-ink-mute">
          {event.start_date} ~ {event.end_date}
        </p>
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          {event.category && <span className="rounded bg-track px-1.5 py-0.5 text-ink-sub">{event.category}</span>}
          {event.is_free && <span className="rounded bg-primary-tint px-1.5 py-0.5 font-bold text-primary">무료</span>}
        </p>
        {event.url && (
          <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary underline">
            자세히 보기
          </a>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 3: 구현 (`ContentTabs`, `HubScreen`)**

`frontend/components/hub/ContentTabs.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { KakaoMap } from "@/components/map/KakaoMap";
import { useHubContent } from "@/lib/api/hooks";
import type { EventItem, Place } from "@/lib/api/types";
import { MSG_LOADING, MSG_NOTHING_NEARBY } from "@/lib/messages";
import { CONTENT_TABS, type ContentKind } from "@/lib/themes";
import { EventCard } from "./EventCard";
import { PlaceCard } from "./PlaceCard";

type Props = {
  slug: string;
  hubId: number;
  initial: ContentKind;
  center: { lat: number; lng: number };
  onGone: () => void;
};

export function ContentTabs({ slug, hubId, initial, center, onGone }: Props) {
  const [kind, setKind] = useState<ContentKind>(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const content = useHubContent(slug, hubId, kind);
  const gone = content.error?.status === 404;

  useEffect(() => {
    if (gone) onGone();
  }, [gone, onGone]);

  // items의 모양은 lib/api/types.ts의 Place, EventItem 주석 참고.
  const items = content.data?.items ?? [];
  const places = kind === "event" ? [] : (items as unknown as Place[]);
  const events = kind === "event" ? (items as unknown as EventItem[]) : [];
  const pins = [...places, ...events].map((item, index) => ({
    id: item.id,
    lat: item.lat,
    lng: item.lng,
    label: String(index + 1),
  }));

  const select = (next: ContentKind) => {
    setActiveId(null);
    setKind(next);
  };

  return (
    <section className="space-y-3">
      <div role="tablist" aria-label="주변 종류" className="grid grid-cols-4 gap-1 rounded-lg bg-track p-1">
        {CONTENT_TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            aria-selected={kind === tab.kind}
            onClick={() => select(tab.kind)}
            className={`rounded-md py-2 text-sm font-semibold ${kind === tab.kind ? "bg-card text-primary" : "text-ink-sub"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <KakaoMap pins={pins} activeId={activeId} center={center} level={4} />
      {content.isPending && <p className="py-6 text-center text-ink-mute">{MSG_LOADING}</p>}
      {content.error && !gone && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {content.error.message}
        </p>
      )}
      {content.data?.error && <p className="text-sm font-semibold text-accent">{content.data.error}</p>}
      {content.data && !content.data.error && items.length === 0 && (
        <p className="py-6 text-center text-ink-mute">{MSG_NOTHING_NEARBY}</p>
      )}
      <ul className="space-y-2">
        {places.map((place, index) => (
          <li key={place.id}>
            <PlaceCard place={place} index={index} active={place.id === activeId} onSelect={() => setActiveId(place.id)} />
          </li>
        ))}
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`frontend/components/hub/HubScreen.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { CARD } from "@/components/ui/styles";
import { useResult } from "@/lib/api/hooks";
import type { ResultFilter } from "@/lib/filter";
import { MSG_LOADING } from "@/lib/messages";
import { firstTab } from "@/lib/themes";
import { ContentTabs } from "./ContentTabs";
import { HubHeader } from "./HubHeader";

type Props = { slug: string; hubId: number; filter: ResultFilter; onGone: () => void };

export function HubScreen({ slug, hubId, filter, onGone }: Props) {
  // 거점 단건 API는 없다. 추천 결과에서 찾는다. 이 화면에서는 폴링하지 않는다.
  const result = useResult(slug, filter, { poll: false });
  const rec = result.data?.recommendations.find((r) => r.hub_id === hubId) ?? null;
  const missing = result.isSuccess && rec === null;

  // 데이터 재적재로 거점 id가 바뀌면 여기로 온다. 안내와 이동은 한 번만 한다.
  const fired = useRef(false);
  const gone = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    onGone();
  }, [onGone]);

  useEffect(() => {
    if (missing) gone();
  }, [missing, gone]);

  if (result.error) {
    return (
      <p role="alert" className={`${CARD} text-center font-semibold`}>
        {result.error.message}
      </p>
    );
  }
  if (!rec) return <p className="py-10 text-center text-ink-mute">{MSG_LOADING}</p>;

  return (
    <div className="space-y-4">
      <HubHeader rec={rec} />
      <ContentTabs
        slug={slug}
        hubId={hubId}
        initial={firstTab(result.data?.theme)}
        center={{ lat: rec.lat, lng: rec.lng }}
        onGone={gone}
      />
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npm test -- components/hub`
Expected: 7 passed

- [ ] **Step 5: 경로 연결**

`frontend/app/r/[slug]/hubs/[hubId]/page.tsx`:

```tsx
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HubScreen } from "@/components/hub/HubScreen";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { useToast } from "@/components/ui/Toast";
import { filterFromSearch, filterQuery } from "@/lib/filter";
import { MSG_HUB_GONE } from "@/lib/messages";

function HubPage() {
  const { slug, hubId } = useParams<{ slug: string; hubId: string }>();
  const router = useRouter();
  const toast = useToast();
  const filter = filterFromSearch(new URLSearchParams(useSearchParams().toString()));
  const query = filterQuery(filter);

  const onGone = () => {
    toast(MSG_HUB_GONE);
    router.replace(`/r/${slug}/result${query}`);
  };

  return (
    <main>
      <StepIndicator current={4} slug={slug} query={query} />
      {/* 숫자가 아닌 hubId는 NaN이 되어 추천 목록에서 못 찾고 onGone으로 간다 */}
      <HubScreen slug={slug} hubId={Number(hubId)} filter={filter} onGone={onGone} />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HubPage />
    </Suspense>
  );
}
```

- [ ] **Step 6: 브라우저 확인**

추천 화면에서 "이 동네 둘러보기":
- 거점 이름, 노선 뱃지, 분위기 한 줄, 지역, "반경 600m", 태그
- 맛집, 카페, 놀거리 탭마다 장소 카드(이름, 분류, 도보 약 N분, 주소, 카카오맵 링크). 카카오 REST 키가 없으면 "지금 불러올 수 없어요"
- 행사 탭은 처음에 잠시 "불러오는 중이에요". 서울, KOPIS 키가 없으면 "지금 불러올 수 없어요" 또는 "근처에서 찾지 못했어요"
- JS 키가 있으면 지도에 장소 번호 핀, 카드를 누르면 그 핀이 빨갛게
- 방을 테마 "카페"로 만들었거나 추천에서 카페 칩을 켠 채 들어오면 카페 탭이 먼저 열린다
- 주소의 거점 번호를 `99999`로 바꾸면 "추천이 바뀌었어요" 토스트와 함께 추천 화면으로 돌아간다
- 단계 표시줄의 "3 추천"을 누르면 필터가 유지된 추천 화면으로

스크린샷(모바일 폭 375)을 찍어 사용자에게 보여준다.

- [ ] **Step 7: 커밋**

Run: `cd frontend && npm test && npm run lint && npx tsc --noEmit && npm run build`
Expected: 전부 통과

```bash
git add frontend/components/hub "frontend/app/r/[slug]/hubs"
git commit -m "feat: hub surroundings screen with content tabs and place pins"
```

---

## Task 17: 흐름 테스트, 커버리지, 실행 문서

**Files:**
- Create: `frontend/e2e/start-backend.mjs`, `frontend/e2e/flow.spec.ts`, `frontend/playwright.config.ts`
- Create: `frontend/README.md` (create-next-app이 만든 것을 교체)
- Modify: `CLAUDE.md`, `dev/active/frontend/frontend-context.md`, `dev/active/frontend/frontend-tasks.md`

**Interfaces:**
- Consumes: 전체. `data-testid="hub-card"`, `data-testid="hub-summary"` (Task 14), 화면의 라벨 문구.
- Produces: `npm run e2e`. 백엔드는 포트 8010에 전용 DB `backend/e2e.db`로, 프론트는 포트 3100으로 띄운다.

- [ ] **Step 1: E2E용 백엔드 실행 스크립트**

`frontend/e2e/start-backend.mjs`:

```js
// E2E용 백엔드. 전용 SQLite 파일을 새로 만들어 파이프라인 산출물을 적재한 뒤 서버를 띄운다.
// 카카오 키를 비워 외부 호출이 나가지 않게 한다 (콘텐츠 요청은 테스트가 가로챈다).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend");
const python = path.join(backend, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const env = {
  ...process.env,
  DATABASE_URL: "sqlite:///./e2e.db",
  CORS_ORIGINS: "http://localhost:3100",
  KAKAO_REST_KEY: "",
  PYTHONIOENCODING: "utf-8",
};

// fs.rmSync는 Node 24의 Windows에서 한글 경로를 만나면 프로세스가 비정상 종료해서 unlinkSync를 쓴다.
const db = path.join(backend, "e2e.db");
if (existsSync(db)) unlinkSync(db);
execFileSync(python, ["-m", "scripts.init_db"], { cwd: backend, env, stdio: "inherit" });
execFileSync(python, ["-m", "pipeline.load"], { cwd: backend, env, stdio: "inherit" });

const server = spawn(python, ["-m", "uvicorn", "app.main:app", "--port", "8010"], { cwd: backend, env, stdio: "inherit" });
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
```

- [ ] **Step 2: Playwright 설정**

`frontend/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  use: { baseURL: "http://localhost:3100", ...devices["Pixel 7"] },
  webServer: [
    {
      command: "node e2e/start-backend.mjs",
      url: "http://localhost:8010/health",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      // 개발 서버는 화면 이동이 첫 컴파일과 겹치면 가끔 404를 보여줘서 흐름이 흔들린다. 빌드한 서버로 돈다.
      command: "npm run build && npm run start -- --port 3100",
      url: "http://localhost:3100",
      timeout: 180_000,
      reuseExistingServer: false,
      env: { NEXT_PUBLIC_API_BASE: "http://localhost:8010", NEXT_PUBLIC_KAKAO_JS_KEY: "" },
    },
  ],
});
```

```bash
cd frontend && npx playwright install chromium
```

- [ ] **Step 3: 흐름 테스트 작성**

`frontend/e2e/flow.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

const FOOD = {
  kind: "food",
  items: [
    {
      id: "1",
      name: "테스트 국밥집",
      category: "국밥",
      address: "서울 어딘가 1",
      distance_m: 210,
      url: "https://place.map.kakao.com/1",
      lat: 37.5,
      lng: 127.0,
    },
  ],
  error: null,
};

async function addPerson(page: Page, nickname: string, station: string) {
  await page.getByLabel("닉네임").fill(nickname);
  await page.getByLabel("출발지 검색").fill(station);
  // 역 이름이 정확히 같은 결과만 (수원을 찾을 때 수원시청이 걸리지 않게)
  await page.getByRole("button", { name: new RegExp(`^${station}\\s`) }).first().click();
  await page.getByRole("button", { name: "출발지 등록" }).click();
  await expect(page.getByText(nickname, { exact: true })).toBeVisible();
}

test("방 만들기부터 주변 둘러보기까지", async ({ page }) => {
  // 카카오와 행사 API는 부르지 않는다. 콘텐츠 응답만 고정한다.
  await page.route(/\/hubs\/\d+\/content/, (route) => route.fulfill({ json: FOOD }));

  await page.goto("/");
  await page.getByLabel("모임 이름").fill("흐름 테스트 모임");
  await page.getByLabel("약속 날짜").fill("2030-01-05");
  await page.getByRole("button", { name: "방 만들고 링크 받기" }).click();

  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9]{6,8}$/);
  await expect(page.getByRole("heading", { name: "흐름 테스트 모임" })).toBeVisible();

  await addPerson(page, "홍대사람", "홍대입구");
  await addPerson(page, "수원사람", "수원");
  await page.getByRole("button", { name: "추천 보기 (2명)" }).click();

  await expect(page).toHaveURL(/\/result/);
  const cards = page.getByTestId("hub-card");
  await expect(cards).toHaveCount(5);

  // 지역을 서울만 남긴다. 상위 5곳을 자르기 전에 걸러지므로 여전히 5곳이 나와야 한다.
  await page.getByRole("button", { name: "경기", exact: true }).click();
  await expect(page.getByRole("button", { name: "경기", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "인천", exact: true }).click();
  await expect(page).toHaveURL(/region=/);
  await expect(page.getByRole("button", { name: "인천", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(async () => {
    const summaries = await page.getByTestId("hub-summary").allTextContents();
    expect(summaries).toHaveLength(5);
    expect(summaries.every((text) => text.startsWith("서울"))).toBe(true);
  }).toPass();

  await page.getByRole("link", { name: "이 동네 둘러보기" }).click();
  await expect(page).toHaveURL(/\/hubs\/\d+\?region=/);
  await expect(page.getByText("테스트 국밥집")).toBeVisible();
  await expect(page.getByText("도보 약 4분")).toBeVisible();
});
```

- [ ] **Step 4: 흐름 테스트 실행**

포트 3000의 프론트 개발 서버가 떠 있으면 먼저 끈다 (같은 폴더에서 개발 서버 두 개가 충돌할 수 있다).

Run: `cd frontend && npm run e2e`
Expected: 1 passed. 처음 실행은 적재와 컴파일 때문에 1~2분 걸린다.

실패하면 `frontend/test-results/`의 스크린샷과 trace로 원인을 찾는다. 화면 문구나 라벨이 달라서 실패한 경우 테스트가 아니라 화면을 설계 문서에 맞춘다.

- [ ] **Step 5: 커버리지 확인**

Run: `cd frontend && npm run coverage`
Expected: `lib/`와 `components/` 줄 커버리지 80% 이상 (기준 미달이면 명령이 실패한다). 미달이면 표에서 가장 낮은 파일의 빠진 분기에 테스트를 추가한다.

- [ ] **Step 6: 실행 문서**

`frontend/README.md` 전체를 바꾼다.

```markdown
# 우리지금만나 프론트엔드

아래 명령은 전부 이 폴더(`frontend/`) 안에서 실행한다. 저장소 루트에서는 `cd frontend` 먼저.

## 로컬 실행

백엔드가 먼저 떠 있어야 한다 (`backend/README.md`, 포트 8000).

    cd frontend
    npm install
    cp .env.example .env.local
    npm run dev

http://localhost:3000 에서 연다.

## 환경 변수 (`.env.local`)

| 이름 | 설명 |
|---|---|
| NEXT_PUBLIC_API_BASE | 백엔드 주소. 기본 http://localhost:8000 |
| NEXT_PUBLIC_KAKAO_JS_KEY | 카카오 JavaScript 키. 비워두면 지도만 빠지고 나머지는 동작한다 |

지도를 쓰려면 카카오 개발자 콘솔의 앱 플랫폼 설정에서 Web 사이트 도메인에 `http://localhost:3000`을 등록한다.

## 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 단위 테스트 (Vitest). 키와 백엔드 없이 돈다 |
| `npm run coverage` | 커버리지. `lib/`, `components/` 80% 미만이면 실패 |
| `npm run e2e` | 흐름 테스트 (Playwright). 백엔드(8010)와 프론트(3100)를 직접 띄운다. 프론트는 빌드해서 띄우므로 1분 넘게 걸린다. 같은 `.next`를 쓰는 3000번 개발 서버는 끄고 실행 |
| `npm run gen:api` | 백엔드 스키마에서 `lib/api/schema.d.ts` 다시 생성. 백엔드 응답 모양을 바꿨을 때 |
| `npm run lint`, `npm run build` | 검사와 빌드 |

## 구조

- `app/`: 경로. URL을 읽어 화면 컴포넌트에 넘기는 얇은 껍데기
- `components/*/*Screen.tsx`: 화면 로직. 라우터에 의존하지 않아 그대로 테스트한다
- `lib/api/`: fetch 래퍼, TanStack Query 훅, 생성된 타입
- `lib/messages.ts`: 프론트 문구. 백엔드가 주는 문구(`detail`)는 그대로 보여준다
- `app/globals.css`: 색 토큰. 컴포넌트에 색 값을 직접 쓰지 않는다
```

`CLAUDE.md`의 "## 명령" 절 제목을 "## 명령 (백엔드는 `backend/`, 프론트는 `frontend/` 안에서 실행)"으로 바꾸고, 데이터 파이프라인 코드 블록 앞에 프론트 블록을 추가한다.

````markdown
프론트엔드:

```bash
cd frontend
npm install                 # 처음 한 번
npm run dev                 # http://localhost:3000 (백엔드가 8000에 떠 있어야 함)
npm test                    # 단위 테스트
npm test -- components/join # 폴더 하나
npm run e2e                 # 흐름 테스트. 3000번 개발 서버는 끄고 실행
npm run gen:api             # 백엔드 스키마가 바뀌면 타입 다시 생성
```
````

"## 아키텍처" 절의 파이프라인 소절 앞에 프론트 소절을 추가한다.

```markdown
### 프론트엔드 (`frontend/`)

Next.js App Router. 브라우저가 FastAPI를 직접 호출하고 TanStack Query로 10초 폴링한다. 서버 쪽 코드는 `app/r/[slug]/layout.tsx`의 링크 미리보기 제목뿐이다.

화면 로직은 `components/{join,result,hub}/*Screen.tsx`에 있고 `app/` 페이지는 URL(슬러그, `?region=`, `?theme=`, `?add=1`)을 읽어 넘기기만 한다. 그래서 컴포넌트 테스트에 라우터 모킹이 필요 없다. 테스트는 MSW로 백엔드를 흉내 낸다 (`lib/test/`).

지켜야 할 것: 타입은 `npm run gen:api`로 생성하고 손으로 맞추지 않는다. 문구는 `lib/messages.ts`와 백엔드 `detail`만 쓴다. 색은 `app/globals.css` 토큰만 쓴다. `localStorage`에는 내가 등록한 participant id만 저장한다 (`hub_id`, `station_id`는 재적재 때 바뀐다). 지역과 테마 필터는 URL 쿼리이고 방 설정을 바꾸지 않는다.
```

"## 규약"의 테스트 항목 끝에 한 문장을 덧붙인다: "프론트는 Vitest와 MSW(`frontend/lib/test/`), 흐름 하나는 Playwright(`frontend/e2e/`)."

- [ ] **Step 7: 전체 검증**

```bash
cd backend && .venv/Scripts/pytest -q
```

Expected: 254 passed

```bash
cd frontend && npm test && npm run lint && npx tsc --noEmit && npm run build
```

Expected: 전부 통과

문장 부호 검사 (엠대시와 가운데 점이 새로 들어가지 않았는지):

저장소 루트에서 실행한다. 금지 문자를 명령에 직접 쓰지 않으려고 코드 번호로 찾는다.

```bash
git diff main --name-only | grep -v "data/raw\|schema.d.ts\|package-lock.json\|frontend/AGENTS.md" | PYTHONIOENCODING=utf-8 backend/.venv/Scripts/python -c "
import sys
bad = (chr(0x2014), chr(0x00B7))
for path in sys.stdin.read().split():
    try:
        text = open(path, encoding='utf-8').read()
    except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
        continue
    for number, line in enumerate(text.splitlines(), 1):
        if any(c in line for c in bad):
            print(f'{path}:{number}: {line.strip()[:80]}')
"
```

Expected: 출력 없음. 나오면 그 줄을 쉼표나 괄호로 고친다 (`raw_name` 데이터와 사용자가 준 원문 인용은 예외).

- [ ] **Step 8: dev docs 마무리와 커밋**

`dev/active/frontend/frontend-tasks.md`의 체크박스를 채우고, `frontend-context.md`의 상태, "계획에서 벗어난 결정", "알려진 한계", "다음 계획에 넘길 것"을 실제 진행에 맞게 고친다 (Last Updated 갱신).

```bash
git add frontend CLAUDE.md dev/active/frontend
git commit -m "test: end to end flow, coverage gate and run docs for the frontend"
```

---

## 완료 기준

- `backend/`에서 `.venv/Scripts/pytest -q`: 254 passed
- `frontend/`에서 `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run coverage`(80% 이상), `npm run e2e` 전부 통과
- 실데이터 확인: 2호선 홍대입구, 수원, 잠실 방에서 지역 전체면 1위 판교(약 44분), 서울만이면 1위 가락시장(약 54분)
- 브라우저에서 네 화면을 모바일 폭으로 끝까지 눌러보고 스크린샷을 사용자에게 보여줬다
- `docs/design.md`, `backend/README.md`, `frontend/README.md`, `CLAUDE.md`, `backend/data/SOURCES.md`가 구현과 맞다
