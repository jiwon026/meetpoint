# 배포 1단계 (지인 테스트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 무료 구간(Vercel, Render, Supabase)에 서비스를 올려 지인이 실제 주소로 쓸 수 있게 하고, 방이 지워져도 남는 규모 통계를 쌓기 시작한다.

**Architecture:** 올리기 전에 코드 여섯 군데를 고친다(약속 날짜 검증, 로그, 카카오 응답 방어, 통계, 방 페이지 메타데이터, 깨우는 중 안내). 그다음 배포 설정 파일(`render.yaml`, GitHub Actions 두 개, RLS SQL)을 넣고, 마지막 태스크에서 사용자와 함께 실제 서비스를 만든다. 브라우저가 백엔드를 직접 부르는 지금 구조는 그대로다.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, pytest, respx / Next.js 16, Vitest, MSW / Render Blueprint, GitHub Actions, Supabase Postgres(Supavisor 세션 모드)

**Spec:** `docs/deploy-design.md` (1단계는 3절, 4절, 5절). 제품 규칙은 `docs/design.md`, 프론트 규칙은 `docs/frontend-design.md`.

## Global Constraints

- 채팅과 문서는 한국어, 코드와 커밋 메시지와 변수명은 영어.
- 문서, 코드 주석, 커밋 메시지, 화면 문구에 엠대시와 가운데 점을 쓰지 않는다. 쉼표, 마침표, 콜론, 괄호를 쓴다.
- 커밋은 conventional commits(`feat`, `fix`, `test`, `docs`, `chore`, `ci`). 메시지 끝에 빈 줄을 두고 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`을 붙인다.
- 백엔드 명령은 `backend/`에서 `.venv/Scripts/...`로, 프론트 명령은 `frontend/`에서 실행한다. 한글을 출력하는 파이썬 스크립트는 `PYTHONIOENCODING=utf-8`을 앞에 붙인다.
- TDD: 실패하는 테스트를 먼저 쓰고, 실패를 확인하고, 최소 구현으로 통과시킨다.
- 백엔드: 라우터는 얇게, 로직은 서비스에. 외부 HTTP는 클라이언트 클래스 안에서만. SQLite와 Postgres 양쪽에서 도는 SQL만 쓴다.
- 사용자에게 보이는 백엔드 문구는 `rooms/service.py`의 `MSG_*`와 `docs/design.md` 8절이 원본이다. 바꾸거나 더하면 둘 다 고친다.
- 프론트: 상태, 에러, 안내 문구는 `lib/messages.ts`. 색은 `app/globals.css` 토큰만. 타입은 `npm run gen:api`로 생성한다(백엔드 스키마가 바뀐 태스크에서 실행).
- 프라이버시: 닉네임, 좌표, 역, 슬러그, 주소, 검색어를 통계와 로그에 남기지 않는다.
- 비밀 값(DB 비밀번호, API 키)은 저장소, 커밋, 채팅, 도구 출력에 넣지 않는다. 값을 확인할 때는 길이나 앞뒤 가림 처리만 출력한다.
- 각 태스크가 끝날 때 기준: `backend`에서 `.venv/Scripts/pytest -q` 전부 통과, `frontend`에서 `npm test`, `npm run lint`, `npx tsc --noEmit` 통과.
- 시작 기준선: 백엔드 258 passed, 프론트 109 passed (브랜치 `feat/deploy`, `main`의 c491fdd에서 갈라짐).

## 파일 구조

새로 만드는 파일:

| 파일 | 책임 |
|---|---|
| `backend/app/clock.py` | UTC 시각을 한국 날짜로 바꾸는 함수 하나 |
| `backend/app/logging_config.py` | 로깅 설정과 접근 로그의 쿼리 문자열 제거 필터 |
| `backend/app/http_json.py` | 외부 응답을 JSON 객체로 읽거나 `UpstreamError`를 던지는 함수 하나 |
| `backend/app/stats.py` | `daily_stats` 카운터 증가 |
| `backend/scripts/stats.py` | 통계 표 출력 |
| `backend/migrations/001_enable_rls.sql`, `backend/migrations/README.md` | RLS SQL과 구조 변경 규칙 |
| `frontend/lib/roomMeta.ts` | 방 페이지 메타데이터(제목 조회, 타임아웃, noindex) |
| `frontend/app/robots.ts` | `/r/` 크롤링 차단 |
| `frontend/components/ui/Loading.tsx` | 불러오는 중 문구와, 오래 걸릴 때의 깨우는 중 문구 |
| `render.yaml` | Render 서비스 정의 |
| `.github/workflows/ci.yml`, `.github/workflows/cleanup.yml` | 테스트 자동 실행, 만료 방 정리 예약 |

고치는 파일은 각 태스크의 Files에 적는다.

---

### Task 1: 약속 날짜 서버 검증과 프론트 상한

**Files:**
- Create: `backend/app/clock.py`, `backend/tests/test_clock.py`
- Modify: `backend/app/rooms/service.py` (`create_room`과 상수), `backend/tests/test_rooms_api.py`
- Modify: `frontend/lib/format.ts`, `frontend/lib/format.test.ts`, `frontend/lib/constants.ts`, `frontend/lib/messages.ts`, `frontend/components/room/CreateRoomForm.tsx`, `frontend/components/room/CreateRoomForm.test.tsx`, `frontend/e2e/flow.spec.ts`
- Modify: `docs/design.md` (8절 표)

**Interfaces:**
- Produces: `app.clock.kst_date(now_utc: datetime) -> date`. Task 4가 통계의 날짜를 구할 때 쓴다.
- Produces: `MAX_MEET_DAYS_AHEAD = 365` (백엔드 `rooms/service.py`, 프론트 `lib/constants.ts`), `addDaysIso(iso: string, days: number): string` (프론트 `lib/format.ts`).

배경: `tests/conftest.py`의 `frozen_room_clock`이 `app.rooms.service.utcnow`를 2026-09-20 12:00(UTC)로 고정한다. 한국 시간으로는 같은 날 21시다. 기존 테스트의 약속 날짜는 2026-09-26과 2026-10-10이라 새 검증에 걸리지 않는다. 검증은 반드시 서비스 모듈의 `utcnow` 이름을 통해 시각을 읽어야 이 고정이 먹는다.

- [ ] **Step 1: `kst_date` 실패 테스트**

`backend/tests/test_clock.py`:

```python
from datetime import date, datetime

from app.clock import kst_date


def test_kst_date_is_nine_hours_ahead_of_utc():
    assert kst_date(datetime(2026, 9, 20, 14, 59)) == date(2026, 9, 20)
    assert kst_date(datetime(2026, 9, 20, 15, 0)) == date(2026, 9, 21)
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && .venv/Scripts/pytest tests/test_clock.py -q`
Expected: `ModuleNotFoundError: No module named 'app.clock'`

- [ ] **Step 3: 구현**

`backend/app/clock.py`:

```python
from datetime import date, datetime, timedelta

KST_OFFSET = timedelta(hours=9)


def kst_date(now_utc: datetime) -> date:
    """서버는 UTC로 돈다. 약속 날짜와 통계의 "오늘"은 한국 시간 기준이다."""
    return (now_utc + KST_OFFSET).date()
```

Run: `.venv/Scripts/pytest tests/test_clock.py -q` → 1 passed

- [ ] **Step 4: 방 만들기 검증 실패 테스트**

`backend/tests/test_rooms_api.py` 끝에 추가:

```python
def test_create_room_rejects_past_date(client):
    response = client.post("/rooms", json={"title": "t", "meet_date": "2026-09-19"})
    assert response.status_code == 422
    assert response.json()["detail"] == "오늘 이후 날짜를 골라주세요"


def test_create_room_accepts_today_and_one_year_ahead(client):
    assert client.post("/rooms", json={"title": "t", "meet_date": "2026-09-20"}).status_code == 201
    assert client.post("/rooms", json={"title": "t", "meet_date": "2027-09-20"}).status_code == 201


def test_create_room_rejects_date_beyond_one_year(client):
    response = client.post("/rooms", json={"title": "t", "meet_date": "2027-09-21"})
    assert response.status_code == 422
    assert response.json()["detail"] == "약속 날짜는 1년 안으로 골라주세요"


def test_create_room_uses_korean_date_for_today(client, monkeypatch):
    # UTC로는 9월 20일 15시 30분이지만 한국은 이미 21일이다.
    monkeypatch.setattr("app.rooms.service.utcnow", lambda: datetime(2026, 9, 20, 15, 30))
    response = client.post("/rooms", json={"title": "t", "meet_date": "2026-09-20"})
    assert response.status_code == 422
```

Run: `.venv/Scripts/pytest tests/test_rooms_api.py -q -k "date"`
Expected: 과거, 상한, 한국 날짜 테스트 3개 FAIL (201이 돌아옴)

- [ ] **Step 5: 서비스에 검증 추가**

`backend/app/rooms/service.py`. import에 `date`와 `kst_date`를 더한다:

```python
from datetime import date, datetime, timedelta
```

```python
from app.clock import kst_date
```

상수 블록(`MAX_PARTICIPANTS = 20` 아래)에:

```python
MAX_MEET_DAYS_AHEAD = 365
```

문구 블록에:

```python
MSG_DATE_PAST = "오늘 이후 날짜를 골라주세요"
MSG_DATE_TOO_FAR = "약속 날짜는 1년 안으로 골라주세요"
```

`create_room` 위에 함수를 더하고, `create_room`의 첫 두 줄을 바꾼다:

```python
def _check_meet_date(meet_date: date, now: datetime) -> None:
    # 먼 미래 날짜를 받으면 "약속 7일 뒤 삭제"가 사실상 무기한 보관이 된다.
    today = kst_date(now)
    if meet_date < today:
        raise HTTPException(status_code=422, detail=MSG_DATE_PAST)
    if meet_date > today + timedelta(days=MAX_MEET_DAYS_AHEAD):
        raise HTTPException(status_code=422, detail=MSG_DATE_TOO_FAR)


def create_room(session: Session, data: RoomCreate) -> Room:
    now = utcnow()
    _check_meet_date(data.meet_date, now)
    expires = datetime.combine(data.meet_date, datetime.min.time()) + timedelta(days=ROOM_KEEP_DAYS)
```

(`create_room`의 나머지는 그대로 둔다.)

- [ ] **Step 6: 백엔드 전체 통과 확인**

Run: `.venv/Scripts/pytest -q`
Expected: 263 passed (258 + 5)

다른 테스트가 422로 깨지면 그 테스트의 약속 날짜가 2026-09-20~2027-09-20 밖인지 확인하고 날짜를 그 범위 안으로 옮긴다. 검증을 느슨하게 하지 않는다.

- [ ] **Step 7: 프론트 `addDaysIso` 실패 테스트**

`frontend/lib/format.test.ts` 끝에 추가 (파일 상단 import에 `addDaysIso`를 더한다):

```ts
test("addDaysIso는 달과 해를 넘겨 더한다", () => {
  expect(addDaysIso("2026-10-05", 7)).toBe("2026-10-12");
  expect(addDaysIso("2026-12-30", 3)).toBe("2027-01-02");
  expect(addDaysIso("2026-10-05", 365)).toBe("2027-10-05");
});
```

Run: `cd frontend && npx vitest run lib/format.test.ts` → FAIL (`addDaysIso` 없음)

- [ ] **Step 8: 프론트 구현**

`frontend/lib/format.ts`의 `todayIso` 아래:

```ts
export function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return todayIso(date);
}
```

`frontend/lib/constants.ts` 끝에:

```ts
// 백엔드 rooms/service.py의 MAX_MEET_DAYS_AHEAD와 같은 값이다.
export const MAX_MEET_DAYS_AHEAD = 365;
```

`frontend/lib/messages.ts`의 `MSG_DATE_REQUIRED` 아래:

```ts
export const MSG_DATE_TOO_FAR = "약속 날짜는 1년 안으로 골라주세요";
```

- [ ] **Step 9: 폼 실패 테스트**

`frontend/components/room/CreateRoomForm.test.tsx`의 "지난 날짜는 요청하지 않고 안내한다" 테스트 아래에 추가 (`TODAY`는 이 파일에서 `"2026-10-02"`다):

```tsx
test("1년 넘는 날짜는 요청하지 않고 안내한다", async () => {
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  fill("금요일 저녁", "2027-10-03");
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  expect(screen.getByRole("alert")).toHaveTextContent("약속 날짜는 1년 안으로 골라주세요");
});

test("날짜 입력에 오늘과 1년 뒤를 범위로 건다", () => {
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  const input = screen.getByLabelText("약속 날짜");
  expect(input).toHaveAttribute("min", "2026-10-02");
  expect(input).toHaveAttribute("max", "2027-10-02");
});
```

Run: `npx vitest run components/room/CreateRoomForm.test.tsx` → 2 FAIL

- [ ] **Step 10: 폼 구현**

`frontend/components/room/CreateRoomForm.tsx`. import를 고친다:

```tsx
import { MAX_MEET_DAYS_AHEAD } from "@/lib/constants";
import { addDaysIso } from "@/lib/format";
import {
  MSG_DATE_REQUIRED,
  MSG_DATE_TOO_FAR,
  MSG_PRIVACY,
  MSG_REGION_REQUIRED,
  MSG_TITLE_REQUIRED,
} from "@/lib/messages";
```

`const busy = ...` 아래에:

```tsx
  // today는 첫 렌더에서 빈 문자열일 수 있다 (app/page.tsx 참고).
  const maxDate = today ? addDaysIso(today, MAX_MEET_DAYS_AHEAD) : "";
```

`submit`의 날짜 검사 바로 아래(지역 검사 위)에:

```tsx
    if (maxDate && meetDate > maxDate) {
      setProblem(MSG_DATE_TOO_FAR);
      return;
    }
```

날짜 `<input>`에 `min={today}` 다음 줄로:

```tsx
            max={maxDate || undefined}
```

Run: `npx vitest run components/room lib/format.test.ts` → 전부 PASS

- [ ] **Step 11: 흐름 테스트의 날짜를 상대 날짜로**

`frontend/e2e/flow.spec.ts`. 파일 상단 import 아래에:

```ts
import { addDaysIso, todayIso } from "../lib/format";

// 서버가 지난 날짜와 1년 넘는 날짜를 거절하므로 실행 시점 기준으로 잡는다.
const MEET_DATE = addDaysIso(todayIso(), 7);
```

`await page.getByLabel("약속 날짜").fill("2030-01-05");`를 다음으로 바꾼다:

```ts
  await page.getByLabel("약속 날짜").fill(MEET_DATE);
```

파일 안에 `2030`이 다른 곳(고정 응답의 날짜 등)에도 있으면 그대로 둔다. 방 만들기 입력만 바꾼다.

- [ ] **Step 12: `docs/design.md` 8절**

"방 만들기에서 날짜가 없거나 오늘 이전" 행을 다음 두 행으로 바꾼다:

```markdown
| 방 만들기에서 날짜가 없거나 오늘 이전 | "오늘 이후 날짜를 골라주세요" (프론트 `MSG_DATE_REQUIRED`, 백엔드 `MSG_DATE_PAST`. 서버는 한국 시간 기준으로 본다) |
| 방 만들기에서 날짜가 1년(365일)보다 뒤 | "약속 날짜는 1년 안으로 골라주세요" (프론트와 백엔드 `MSG_DATE_TOO_FAR`) |
```

- [ ] **Step 13: 전체 확인과 커밋**

Run: `cd backend && .venv/Scripts/pytest -q` → 263 passed
Run: `cd frontend && npm test && npm run lint && npx tsc --noEmit` → 112 passed, 오류 없음
Run (3000번 개발 서버가 꺼져 있을 때): `npm run e2e` → 1 passed

```bash
git add backend/app/clock.py backend/app/rooms/service.py backend/tests/test_clock.py backend/tests/test_rooms_api.py frontend/lib frontend/components/room frontend/e2e/flow.spec.ts docs/design.md
git commit -m "feat: reject past and far-future meet dates on the server"
```

---

### Task 2: 로그에 주소, 검색어, 키를 남기지 않기

**Files:**
- Create: `backend/app/logging_config.py`, `backend/tests/test_logging_config.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces: `app.logging_config.configure_logging() -> None`, `app.logging_config.StripQueryFilter`.

배경: httpx는 INFO 수준에서 `HTTP Request: GET https://dapi.kakao.com/...?query=주소` 형태로 요청 URL 전체를 남긴다. 서울시 API는 URL 경로에 키가 들어 있다. uvicorn의 접근 로그(`uvicorn.access` 로거)는 `record.args`가 `(클라이언트 주소, 메서드, 쿼리를 포함한 경로, HTTP 버전, 상태 코드)`다.

- [ ] **Step 1: 실패 테스트**

`backend/tests/test_logging_config.py`:

```python
import logging

from app.logging_config import StripQueryFilter, configure_logging


def _access_record(path: str) -> logging.LogRecord:
    return logging.LogRecord(
        name="uvicorn.access", level=logging.INFO, pathname="", lineno=0,
        msg='%s - "%s %s HTTP/%s" %d', args=("127.0.0.1:5000", "GET", path, "1.1", 200), exc_info=None,
    )


def test_strip_query_filter_removes_query_string():
    record = _access_record("/stations?q=%EC%84%9C%EC%9A%B8%EC%8B%9C+%EA%B0%95%EB%82%A8%EA%B5%AC")
    assert StripQueryFilter().filter(record) is True
    assert record.getMessage() == '127.0.0.1:5000 - "GET /stations HTTP/1.1" 200'


def test_strip_query_filter_keeps_plain_paths_and_other_records():
    record = _access_record("/health")
    StripQueryFilter().filter(record)
    assert record.getMessage() == '127.0.0.1:5000 - "GET /health HTTP/1.1" 200'
    other = logging.LogRecord("x", logging.INFO, "", 0, "hello %s", ("a?b",), None)
    assert StripQueryFilter().filter(other) is True
    assert other.getMessage() == "hello a?b"


def test_configure_logging_quiets_http_clients_and_is_idempotent():
    configure_logging()
    configure_logging()
    assert logging.getLogger("httpx").level == logging.WARNING
    assert logging.getLogger("httpcore").level == logging.WARNING
    filters = [f for f in logging.getLogger("uvicorn.access").filters if isinstance(f, StripQueryFilter)]
    assert len(filters) == 1
```

Run: `.venv/Scripts/pytest tests/test_logging_config.py -q` → `ModuleNotFoundError`

- [ ] **Step 2: 구현**

`backend/app/logging_config.py`:

```python
import logging

ACCESS_LOGGER = "uvicorn.access"
# 두 로거는 INFO에서 요청 URL 전체를 남긴다. URL에는 주소 검색어와 API 키가 들어 있다.
QUIET_LOGGERS = ("httpx", "httpcore")
PATH_ARG_INDEX = 2


class StripQueryFilter(logging.Filter):
    """uvicorn 접근 로그의 경로에서 쿼리 문자열을 지운다. 검색어 칸에 주소를 치는 사람이 있다."""

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) > PATH_ARG_INDEX and isinstance(args[PATH_ARG_INDEX], str):
            path = args[PATH_ARG_INDEX].split("?", 1)[0]
            record.args = (*args[:PATH_ARG_INDEX], path, *args[PATH_ARG_INDEX + 1 :])
        return True


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    for name in QUIET_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)
    access = logging.getLogger(ACCESS_LOGGER)
    if not any(isinstance(f, StripQueryFilter) for f in access.filters):
        access.addFilter(StripQueryFilter())
```

`StripQueryFilter`는 접근 로그가 아닌 레코드(`args[2]`가 문자열인 다른 로그)도 건드릴 수 있지만, 이 필터는 `uvicorn.access` 로거에만 붙는다. Step 1의 두 번째 테스트에서 `other` 레코드는 인자가 하나라 바뀌지 않는다.

`backend/app/main.py`의 `create_app` 첫 줄에 호출을 넣는다:

```python
from app.logging_config import configure_logging
```

```python
def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
```

- [ ] **Step 3: 통과 확인**

Run: `.venv/Scripts/pytest -q` → 266 passed

- [ ] **Step 4: 실제 서버 로그로 확인**

8000번이 비어 있으면 다른 포트로 띄워 확인한다:

```bash
.venv/Scripts/uvicorn app.main:app --port 8020 > /tmp/log-check.txt 2>&1 &
sleep 4; curl -s "http://localhost:8020/stations?q=SECRETWORD" > /dev/null; sleep 1
grep -c "SECRETWORD" /tmp/log-check.txt; grep "stations" /tmp/log-check.txt
```

Expected: 개수 `0`, 그리고 `"GET /stations HTTP/1.1" 200` 줄이 보인다. 확인 뒤 8020번 프로세스를 끈다(`netstat -ano | grep ":8020"`로 PID를 찾아 `taskkill //PID <pid> //T //F`).

- [ ] **Step 5: 커밋**

```bash
git add backend/app/logging_config.py backend/app/main.py backend/tests/test_logging_config.py
git commit -m "feat: keep search text, addresses and API keys out of server logs"
```

---

### Task 3: 카카오가 JSON이 아닌 200을 줄 때 500이 나지 않게

**Files:**
- Create: `backend/app/http_json.py`, `backend/tests/test_http_json.py`
- Modify: `backend/app/events/seoul.py`, `backend/app/geocoding/kakao.py`, `backend/app/places/kakao_local.py`, `backend/app/rooms/service.py` (`_resolve_point`), `backend/app/rooms/router.py` (`place_search`)
- Modify: `backend/tests/test_geocoder.py`, `backend/tests/test_place_search_api.py`, `backend/tests/test_rooms_api.py`

**Interfaces:**
- Produces: `app.http_json.json_object(response: httpx.Response, source: str) -> dict`. JSON이 아니거나 객체가 아니면 `app.errors.UpstreamError`.

배경: `response.json()`은 본문이 JSON이 아니면 `ValueError`(JSONDecodeError)를 던지고, 지금 코드는 `httpx.HTTPError`만 잡는다. 행사 API에서 같은 문제로 500이 났었다(`events/seoul.py`의 `_json_or_raise`). 그 함수를 공용으로 옮긴다.

- [ ] **Step 1: 공용 함수 실패 테스트**

`backend/tests/test_http_json.py`:

```python
import httpx
import pytest

from app.errors import UpstreamError
from app.http_json import json_object


def test_json_object_returns_dict():
    assert json_object(httpx.Response(200, json={"a": 1}), "x") == {"a": 1}


@pytest.mark.parametrize("response", [
    httpx.Response(200, text="<html>error</html>"),
    httpx.Response(200, text=""),
    httpx.Response(200, json=[1, 2]),
])
def test_json_object_raises_upstream_error(response):
    with pytest.raises(UpstreamError, match="^x: "):
        json_object(response, "x")
```

Run: `.venv/Scripts/pytest tests/test_http_json.py -q` → `ModuleNotFoundError`

- [ ] **Step 2: 구현과 서울시 클라이언트 정리**

`backend/app/http_json.py`:

```python
import httpx

from app.errors import UpstreamError


def json_object(response: httpx.Response, source: str) -> dict:
    """외부 API는 오류를 200과 HTML이나 XML 본문으로 돌려주기도 한다. 그때는 UpstreamError로 바꾼다."""
    try:
        payload = response.json()
    except ValueError as exc:
        raise UpstreamError(f"{source}: non-json response") from exc
    if not isinstance(payload, dict):
        raise UpstreamError(f"{source}: unexpected response shape")
    return payload
```

`backend/app/events/seoul.py`에서 `_json_or_raise` 함수를 지우고, import에 `from app.http_json import json_object`를 더하고, 호출을 바꾼다:

```python
            batch = _rows_or_raise(json_object(response, "seoul api"))
```

Run: `.venv/Scripts/pytest tests/test_http_json.py tests/test_events_seoul.py tests/test_content_api.py -q` → 전부 PASS

- [ ] **Step 3: 카카오 클라이언트 실패 테스트**

`backend/tests/test_geocoder.py` 끝에 추가 (상단 import에 `from app.errors import UpstreamError`):

```python
@respx.mock
def test_geocode_raises_upstream_error_on_non_json_body():
    respx.get(ADDRESS_URL).mock(return_value=httpx.Response(200, text="<html>blocked</html>"))
    with pytest.raises(UpstreamError):
        KakaoGeocoder(rest_key="k").geocode("서울 마포구 양화로 160")


@respx.mock
def test_geocode_raises_upstream_error_when_coordinates_are_missing():
    respx.get(ADDRESS_URL).mock(return_value=httpx.Response(200, json={"documents": [{"x": "abc"}]}))
    with pytest.raises(UpstreamError):
        KakaoGeocoder(rest_key="k").geocode("서울 마포구 양화로 160")
```

`backend/tests/test_place_search_api.py` 끝에 추가:

```python
@respx.mock
def test_search_non_json_body_returns_friendly_error(client):
    respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, text="<html>blocked</html>"))
    response = client.post("/places/search", json={"q": "강남역"})
    assert response.status_code == 200
    assert response.json() == {"items": [], "error": "지금 불러올 수 없어요"}
```

`backend/tests/test_rooms_api.py`의 `BrokenGeocoder` 테스트 아래에 추가 (상단 import에 `from app.errors import UpstreamError`):

```python
class GarbledGeocoder:
    def geocode(self, query: str):
        raise UpstreamError("kakao local: non-json response")


def test_geocoder_bad_response_returns_503_with_guidance(seeded):
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: GarbledGeocoder()
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    client = TestClient(app)
    slug = _create_room(client)["slug"]
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": "a", "address": "홍대 근처"})
    assert response.status_code == 503
    assert response.json()["detail"] == "주소를 찾지 못했어요. 역을 직접 골라주세요."
```

Run: `.venv/Scripts/pytest tests/test_geocoder.py tests/test_place_search_api.py tests/test_rooms_api.py -q`
Expected: 새 테스트 4개 FAIL (JSONDecodeError, KeyError 또는 UpstreamError가 500으로 샘)

- [ ] **Step 4: 구현**

`backend/app/geocoding/kakao.py`. import에 더한다:

```python
from app.errors import UpstreamError
from app.http_json import json_object

KAKAO_SOURCE = "kakao local"
```

`_first_point`의 `response.raise_for_status()` 아래를 바꾼다:

```python
        documents = json_object(response, KAKAO_SOURCE).get("documents", [])
        if not documents:
            return None
        try:
            return GeoPoint(lat=float(documents[0]["y"]), lng=float(documents[0]["x"]))
        except (KeyError, TypeError, ValueError) as exc:
            raise UpstreamError(f"{KAKAO_SOURCE}: document without coordinates") from exc
```

`backend/app/places/kakao_local.py`. import를 고친다:

```python
from app.geocoding.kakao import KAKAO_LOCAL_BASE, KAKAO_SOURCE
from app.http_json import json_object
```

`_get`과 `_total`의 마지막 줄을 각각 바꾼다:

```python
        return list(json_object(response, KAKAO_SOURCE).get("documents", []))
```

```python
        return int(json_object(response, KAKAO_SOURCE).get("meta", {}).get("total_count", 0))
```

`backend/app/rooms/service.py`. import에 `from app.errors import UpstreamError`를 더하고 `_resolve_point`의 except를 바꾼다:

```python
    except (httpx.HTTPError, UpstreamError) as exc:
```

`backend/app/rooms/router.py`의 `place_search`에서 except를 바꾼다:

```python
    except (httpx.HTTPError, UpstreamError) as exc:
```

- [ ] **Step 5: 통과 확인과 커밋**

Run: `.venv/Scripts/pytest -q` → 274 passed (266 + 공용 4 + 카카오 4)

```bash
git add backend/app backend/tests
git commit -m "fix: turn non-JSON Kakao responses into upstream errors instead of 500s"
```

---

### Task 4: 규모 통계 (`daily_stats`)

**Files:**
- Create: `backend/app/stats.py`, `backend/scripts/stats.py`, `backend/tests/test_stats.py`
- Modify: `backend/app/models.py`, `backend/app/rooms/service.py`, `backend/tests/test_models.py`(표 목록을 검사하는 테스트가 있으면)
- Modify: `backend/README.md` (운영 절에 통계 읽는 법)

**Interfaces:**
- Consumes: `app.clock.kst_date(now_utc: datetime) -> date` (Task 1).
- Produces: 모델 `DailyStat`(표 `daily_stats`: `day`, `rooms_created`, `participants_added`, `rooms_with_result`), `Room.first_result_at: datetime | None`.
- Produces: `app.stats.bump(session: Session, column: StatColumn, now: datetime) -> None`. `StatColumn = Literal["rooms_created", "participants_added", "rooms_with_result"]`. 절대 예외를 밖으로 내보내지 않는다.
- Produces: `scripts.stats.summarize(session: Session) -> list[DailyStat]`.

설계 요점 (`docs/deploy-design.md` 3.6):
- `bump`는 호출하는 쪽의 본 작업이 커밋된 뒤에 부른다. 실패하면 `rollback`하고 경고 로그만 남긴다.
- 증가는 `UPDATE ... SET n = n + 1`이고, 그날 행이 없으면 `INSERT`, 동시에 들어와 `INSERT`가 기본 키 충돌로 실패하면 `rollback` 뒤 `UPDATE`를 한 번 더 한다. SAVEPOINT는 쓰지 않는다(SQLite 드라이버에서 믿을 수 없다).
- "추천까지 간 방"은 조건부 `UPDATE rooms SET first_result_at = ? WHERE id = ? AND first_result_at IS NULL`의 바뀐 행 수가 1일 때만 센다. 폴링과 동시 요청에도 방당 한 번이다.

- [ ] **Step 1: `bump` 실패 테스트**

`backend/tests/test_stats.py`:

```python
from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import get_db
from app.deps import get_geocoder, get_matrix
from app.main import create_app
from app.models import DailyStat, Room
from app.stats import bump
from app.transit.matrix import StationTimeMatrix
from scripts.stats import summarize

NOW = datetime(2026, 9, 20, 12, 0)   # conftest의 고정 시각과 같다. 한국 날짜로 2026-09-20.
DAY = date(2026, 9, 20)


def _row(session, day=DAY) -> DailyStat | None:
    session.expire_all()
    return session.get(DailyStat, day)


def test_bump_creates_the_day_row_then_increments(session):
    bump(session, "rooms_created", NOW)
    bump(session, "rooms_created", NOW)
    bump(session, "participants_added", NOW)
    row = _row(session)
    assert (row.rooms_created, row.participants_added, row.rooms_with_result) == (2, 1, 0)


def test_bump_uses_korean_date(session):
    bump(session, "rooms_created", datetime(2026, 9, 20, 15, 30))   # 한국은 21일 0시 30분
    assert _row(session) is None
    assert _row(session, date(2026, 9, 21)).rooms_created == 1


def test_bump_never_raises(session):
    DailyStat.__table__.drop(session.get_bind())
    bump(session, "rooms_created", NOW)   # 표가 없어도 조용히 넘어간다
```

Run: `.venv/Scripts/pytest tests/test_stats.py -q` → `ImportError` (`DailyStat`, `app.stats`, `scripts.stats` 없음)

- [ ] **Step 2: 모델**

`backend/app/models.py`. `Room`에 열을 더한다 (`theme` 아래):

```python
    # 추천이 처음 계산된 시각. 통계에서 방당 한 번만 세려고 둔다.
    first_result_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
```

파일 끝에 표를 더한다:

```python
class DailyStat(Base):
    """날짜별 개수만 담는다. 방이 지워져도 남는다. 개인 정보를 넣지 않는다."""

    __tablename__ = "daily_stats"

    day: Mapped[date] = mapped_column(Date, primary_key=True)  # 한국 시간 기준
    rooms_created: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    participants_added: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    rooms_with_result: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
```

- [ ] **Step 3: `bump`와 `summarize` 구현**

`backend/app/stats.py`:

```python
import logging
from datetime import datetime
from typing import Literal

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.clock import kst_date
from app.models import DailyStat

logger = logging.getLogger(__name__)

StatColumn = Literal["rooms_created", "participants_added", "rooms_with_result"]


def _increment(session: Session, day, column: StatColumn) -> int:
    counter = getattr(DailyStat, column)
    statement = (
        update(DailyStat)
        .where(DailyStat.day == day)
        .values({column: counter + 1})
        .execution_options(synchronize_session=False)
    )
    return session.execute(statement).rowcount


def bump(session: Session, column: StatColumn, now: datetime) -> None:
    """그날의 개수를 1 올린다. 본 작업이 커밋된 뒤에 부른다. 실패해도 요청을 깨지 않는다."""
    day = kst_date(now)
    try:
        if _increment(session, day, column) == 0:
            session.add(DailyStat(day=day, **{column: 1}))
        session.commit()
    except IntegrityError:
        # 다른 요청이 같은 날의 행을 먼저 만들었다. 이제 행이 있으니 다시 올린다.
        session.rollback()
        try:
            _increment(session, day, column)
            session.commit()
        except SQLAlchemyError as exc:
            session.rollback()
            logger.warning("stat bump failed column=%s error=%s", column, type(exc).__name__)
    except SQLAlchemyError as exc:
        session.rollback()
        logger.warning("stat bump failed column=%s error=%s", column, type(exc).__name__)
```

`backend/scripts/stats.py`:

```python
"""날짜별 규모 통계를 출력한다.

실행: python -m scripts.stats  (대상 DB는 .env 또는 환경 변수의 DATABASE_URL)
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import DailyStat


def summarize(session: Session) -> list[DailyStat]:
    return list(session.scalars(select(DailyStat).order_by(DailyStat.day)).all())


if __name__ == "__main__":
    with SessionLocal() as s:
        rows = summarize(s)
    print("day         rooms  people  with_result")
    for r in rows:
        print(f"{r.day}  {r.rooms_created:5d}  {r.participants_added:6d}  {r.rooms_with_result:11d}")
    rooms = sum(r.rooms_created for r in rows)
    people = sum(r.participants_added for r in rows)
    reached = sum(r.rooms_with_result for r in rows)
    print(f"total       {rooms:5d}  {people:6d}  {reached:11d}")
    if rooms:
        print(f"people per room: {people / rooms:.1f}, rooms that reached a result: {reached / rooms:.0%}")
```

Run: `.venv/Scripts/pytest tests/test_stats.py -q` → 3 passed

- [ ] **Step 4: API 연결 실패 테스트**

`backend/tests/test_stats.py` 끝에 추가:

```python
@pytest.fixture
def client(seeded):
    app = create_app()

    def _db():
        yield seeded

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_geocoder] = lambda: None
    app.dependency_overrides[get_matrix] = lambda: StationTimeMatrix.load(seeded, {1, 2, 3, 4})
    return TestClient(app)


def _room(client) -> str:
    return client.post("/rooms", json={"title": "t", "meet_date": "2026-09-26"}).json()["slug"]


def _join(client, slug: str, nickname: str, station_id: int) -> int:
    response = client.post(f"/rooms/{slug}/participants", json={"nickname": nickname, "station_id": station_id})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_creating_rooms_and_joining_are_counted(client, seeded):
    slug = _room(client)
    _room(client)
    first = _join(client, slug, "a", 1)
    _join(client, slug, "b", 3)
    # 빼기와 다시 넣기는 새 사람이 아니다.
    client.patch(f"/rooms/{slug}/participants/{first}", json={"active": False})
    client.patch(f"/rooms/{slug}/participants/{first}", json={"active": True})
    row = _row(seeded)
    assert (row.rooms_created, row.participants_added) == (2, 2)


def test_rejected_requests_are_not_counted(client, seeded):
    client.post("/rooms", json={"title": "", "meet_date": "2026-09-26"})
    slug = _room(client)
    client.post(f"/rooms/{slug}/participants", json={"nickname": "a", "station_id": 999})
    row = _row(seeded)
    assert (row.rooms_created, row.participants_added) == (1, 0)


def test_first_ready_result_is_counted_once_per_room(client, seeded):
    slug = _room(client)
    _join(client, slug, "a", 1)
    assert client.get(f"/rooms/{slug}/result").json()["status"] == "waiting"
    assert _row(seeded).rooms_with_result == 0
    _join(client, slug, "b", 3)
    for _ in range(3):
        assert client.get(f"/rooms/{slug}/result").json()["status"] == "ready"
    assert _row(seeded).rooms_with_result == 1
    assert seeded.scalar(select(Room).where(Room.slug == slug)).first_result_at == NOW


def test_requests_succeed_when_the_stats_table_is_missing(client, seeded):
    DailyStat.__table__.drop(seeded.get_bind())
    slug = _room(client)
    _join(client, slug, "a", 1)
    _join(client, slug, "b", 3)
    body = client.get(f"/rooms/{slug}/result").json()
    assert body["status"] == "ready"
    assert len(body["recommendations"]) > 0


def test_summarize_orders_by_day(session):
    bump(session, "rooms_created", datetime(2026, 9, 21, 3, 0))
    bump(session, "rooms_created", NOW)
    assert [r.day for r in summarize(session)] == [DAY, date(2026, 9, 21)]
```

Run: `.venv/Scripts/pytest tests/test_stats.py -q`
Expected: 개수 테스트 3개 FAIL (행이 없어 `row`가 `None`), 표가 없는 테스트와 `summarize` 테스트는 PASS

- [ ] **Step 5: 서비스에 연결**

`backend/app/rooms/service.py`. import에 더한다:

```python
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
```

```python
from app.stats import bump
```

`create_room`의 `session.refresh(room)` 다음, `return room` 앞에:

```python
    bump(session, "rooms_created", now)
```

`add_participant`의 마지막 `session.refresh(room)` 다음, `return participant` 앞에:

```python
    bump(session, "participants_added", participant.created_at)
```

`compute_result` 위에 함수를 더한다:

```python
def _mark_first_result(session: Session, room: Room) -> None:
    """추천이 처음 나온 방을 한 번만 센다. 폴링과 동시 요청에도 방당 한 번이다."""
    if room.first_result_at is not None:
        return
    now = utcnow()
    try:
        claimed = session.execute(
            update(Room)
            .where(Room.id == room.id, Room.first_result_at.is_(None))
            .values(first_result_at=now)
            .execution_options(synchronize_session=False)
        ).rowcount
        session.commit()
    except SQLAlchemyError as exc:
        session.rollback()
        logger.warning("first result mark failed error=%s", type(exc).__name__)
        return
    session.refresh(room)
    if claimed == 1:
        bump(session, "rooms_with_result", now)
```

`compute_result`의 마지막 `return ResultOut(status="ready", ...)`를 변수에 담았다가 표시한 뒤 돌려주게 바꾼다:

```python
    result = ResultOut(
        status="ready",
        recommendations=[
            _recommendation(s, hub_by_id[s.hub_id], lines[s.hub_id], s.hub_id in matching, station_by_id)
            for s in ranking.scores
        ],
        best_max_minutes=ranking.best_max_minutes,
        regions=applied_regions,
        theme=applied_theme,
    )
    # 응답을 다 만든 뒤에 표시한다. 통계 기록이 실패해도 응답은 그대로 나간다.
    _mark_first_result(session, room)
    return result
```

- [ ] **Step 6: 통과 확인**

Run: `.venv/Scripts/pytest -q`
Expected: 282 passed (274 + 8). `tests/test_models.py`에 표 이름 목록을 비교하는 테스트가 있어 깨지면 `daily_stats`를 그 목록에 더한다.

- [ ] **Step 7: 로컬 DB에 반영하고 스크립트 확인**

`init_db`는 기존 표에 열을 더하지 않는다. 로컬 `dev.db`는 다시 만든다 (8000번 백엔드가 떠 있으면 먼저 끈다):

```bash
rm dev.db
.venv/Scripts/python -m scripts.init_db
.venv/Scripts/python -m pipeline.load
.venv/Scripts/python -m scripts.stats
```

Expected: `tables created`, 적재 개수 네 줄(station_groups 646, stations 791, hubs 100, station_times 124978), 통계는 머리글과 `total 0 0 0`.

- [ ] **Step 8: README와 커밋**

`backend/README.md`의 "운영" 절 끝에 추가:

```markdown
- 규모 통계: `python -m scripts.stats`가 `daily_stats`(날짜별 만든 방 수, 등록한 참가자 수, 추천까지 간 방 수)를 출력한다. 날짜는 한국 시간 기준이고 개인 정보는 들어 있지 않다. 방이 지워져도 남는다.
```

같은 파일 "데이터 적재" 절의 "가장 최근 변경(2026-10)은 ..." 문장에 `rooms.first_result_at`과 `daily_stats` 표를 더한다.

```bash
git add backend/app backend/scripts/stats.py backend/tests backend/README.md
git commit -m "feat: count rooms, participants and rooms that reached a result per day"
```

(백엔드 응답 스키마는 바뀌지 않았으므로 `npm run gen:api`는 필요 없다.)

---

### Task 5: 방 페이지를 검색에서 숨기고 제목 조회에 타임아웃

**Files:**
- Create: `frontend/lib/roomMeta.ts`, `frontend/lib/roomMeta.test.ts`, `frontend/app/robots.ts`
- Modify: `frontend/app/r/[slug]/layout.tsx`

**Interfaces:**
- Produces: `roomMetadata(slug: string, timeoutMs?: number): Promise<Metadata>` (`frontend/lib/roomMeta.ts`), `META_TIMEOUT_MS = 3000`.

배경: `app/r/[slug]/layout.tsx`의 `generateMetadata`는 Vercel 서버에서 백엔드를 부른다. 백엔드가 잠들어 있으면 응답까지 최대 1분이 걸리고 그동안 페이지 자체가 뜨지 않는다. 또 방 링크는 아는 사람만 보는 주소라 검색 엔진에 잡히면 안 된다. 테스트 설정(`vitest.config.mts`)이 `lib`와 `components`만 보므로 로직을 `lib`에 두고 `layout.tsx`는 한 줄로 만든다.

- [ ] **Step 1: 실패 테스트**

`frontend/lib/roomMeta.test.ts`:

```ts
import { delay, http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { API, room } from "@/lib/test/fixtures";
import { server } from "@/lib/test/server";
import { roomMetadata } from "./roomMeta";

const NOINDEX = { index: false, follow: false };

test("방 제목과 약속 날짜를 넣고 검색 노출은 막는다", async () => {
  server.use(
    http.get(`${API}/rooms/abc123`, () => HttpResponse.json(room({ title: "주말 모임", meet_date: "2026-10-10" }))),
  );
  const meta = await roomMetadata("abc123");
  expect(meta.title).toBe("주말 모임 | 우리지금만나");
  expect(meta.description).toContain("10월 10일");
  expect(meta.robots).toEqual(NOINDEX);
});

test("방이 없으면 기본 제목, 검색 노출은 여전히 막는다", async () => {
  server.use(http.get(`${API}/rooms/abc123`, () => HttpResponse.json({ detail: "x" }, { status: 404 })));
  expect(await roomMetadata("abc123")).toEqual({ title: "우리지금만나", robots: NOINDEX });
});

test("백엔드가 늦으면 기다리지 않고 기본 제목으로 넘어간다", async () => {
  server.use(
    http.get(`${API}/rooms/abc123`, async () => {
      await delay(2000);
      return HttpResponse.json(room());
    }),
  );
  const started = Date.now();
  expect(await roomMetadata("abc123", 50)).toEqual({ title: "우리지금만나", robots: NOINDEX });
  expect(Date.now() - started).toBeLessThan(1000);
});

test("슬러그를 인코딩해서 보낸다", async () => {
  let seen = "";
  server.use(
    http.get(`${API}/rooms/:slug`, ({ request }) => {
      seen = new URL(request.url).pathname;
      return HttpResponse.json(room());
    }),
  );
  await roomMetadata("a b/c");
  expect(seen).toBe("/rooms/a%20b%2Fc");
});
```

Run: `cd frontend && npx vitest run lib/roomMeta.test.ts` → FAIL (모듈 없음)

- [ ] **Step 2: 구현**

`frontend/lib/roomMeta.ts`:

```ts
import type { Metadata } from "next";
import { API_BASE } from "@/lib/api/client";
import type { RoomOut } from "@/lib/api/types";
import { SERVICE_NAME } from "@/lib/constants";
import { formatMeetDate } from "@/lib/format";

// 무료 서버는 잠들었다 깨는 데 1분쯤 걸린다. 제목 때문에 페이지가 그만큼 늦게 뜨면 안 된다.
export const META_TIMEOUT_MS = 3000;

// 방 링크는 아는 사람만 보는 주소다. 검색 엔진에 잡히지 않게 한다.
const NOINDEX = { index: false, follow: false } as const;

async function fetchRoom(slug: string, timeoutMs: number): Promise<RoomOut | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}/rooms/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as RoomOut;
  } catch {
    // 백엔드에 닿지 못했거나 시간이 넘었다. 화면은 떠야 하므로 제목만 기본값으로 둔다.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function roomMetadata(slug: string, timeoutMs: number = META_TIMEOUT_MS): Promise<Metadata> {
  const room = await fetchRoom(slug, timeoutMs);
  if (!room) return { title: SERVICE_NAME, robots: NOINDEX };
  return {
    title: `${room.title} | ${SERVICE_NAME}`,
    description: `${formatMeetDate(room.meet_date)} 약속. 출발지를 넣으면 모두에게 공평한 장소를 찾아줘요.`,
    robots: NOINDEX,
  };
}
```

`frontend/app/r/[slug]/layout.tsx` 전체를 바꾼다:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { roomMetadata } from "@/lib/roomMeta";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return roomMetadata(slug);
}

export default function RoomLayout({ children }: { children: ReactNode }) {
  return children;
}
```

`frontend/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";

// 방 링크(/r/...)는 크롤링하지 않게 한다. 첫 화면은 열어둔다.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/r/" } };
}
```

- [ ] **Step 3: 통과와 빌드 확인**

Run: `npx vitest run lib/roomMeta.test.ts` → 4 passed
Run: `npm test && npm run lint && npx tsc --noEmit` → 116 passed, 오류 없음
Run (3000번 개발 서버를 끄고): `npm run build`
Expected: 경로 목록에 `/robots.txt`가 보인다. 빌드 뒤 개발 서버를 다시 쓰려면 그냥 `npm run dev`.

실제 응답 확인 (백엔드 8000과 `npm run start`가 떠 있을 때, 아무 방이나 만든 뒤):

```bash
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/r/<slug> | grep -o '<meta name="robots"[^>]*>'
```

Expected: `Disallow: /r/`, `<meta name="robots" content="noindex, nofollow"/>`

- [ ] **Step 4: 커밋**

```bash
git add frontend/lib/roomMeta.ts frontend/lib/roomMeta.test.ts frontend/app/robots.ts "frontend/app/r/[slug]/layout.tsx"
git commit -m "feat: keep room pages out of search engines and cap the title lookup at 3 seconds"
```

---

### Task 6: 서버가 깨어나는 동안의 안내

**Files:**
- Create: `frontend/components/ui/Loading.tsx`, `frontend/components/ui/Loading.test.tsx`
- Modify: `frontend/lib/constants.ts`, `frontend/lib/messages.ts`, `frontend/components/join/RoomGate.tsx`, `frontend/components/result/ResultScreen.tsx`, `frontend/components/hub/HubScreen.tsx`, `frontend/components/room/CreateRoomForm.tsx`, `frontend/components/room/CreateRoomForm.test.tsx`
- Modify: `docs/design.md` (8절 표)

**Interfaces:**
- Produces: `<Loading className?: string />`(처음엔 "불러오는 중이에요", `SLOW_MS` 뒤에는 깨우는 중 문구), `<SlowNote />`(처음엔 아무것도 없고 `SLOW_MS` 뒤에 깨우는 중 문구). `SLOW_MS = 4000`, `MSG_WAKING = "서버를 깨우는 중이에요. 최대 1분쯤 걸려요."`.

배경: Render 무료 서비스는 잠든 상태에서 첫 요청을 받으면 약 1분 동안 요청을 붙잡고 있다가 응답한다. 사용자는 오류가 아니라 긴 로딩을 본다. 4초가 넘으면 이유를 알려준다. 주변 화면의 콘텐츠 탭(`ContentTabs`)은 바꾸지 않는다. 그 시점에는 서버가 이미 깨어 있고, 거기서 늦는 것은 외부 API라 문구가 맞지 않는다.

- [ ] **Step 1: 실패 테스트**

`frontend/components/ui/Loading.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Loading, SlowNote } from "./Loading";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test("처음엔 불러오는 중, 4초 뒤에는 서버를 깨우는 중", () => {
  render(<Loading />);
  expect(screen.getByRole("status")).toHaveTextContent("불러오는 중이에요");
  act(() => vi.advanceTimersByTime(3999));
  expect(screen.getByRole("status")).toHaveTextContent("불러오는 중이에요");
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("status")).toHaveTextContent("서버를 깨우는 중이에요. 최대 1분쯤 걸려요.");
});

test("SlowNote는 4초 전에는 아무것도 보이지 않는다", () => {
  const { container } = render(<SlowNote />);
  expect(container).toBeEmptyDOMElement();
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.getByRole("status")).toHaveTextContent("서버를 깨우는 중이에요. 최대 1분쯤 걸려요.");
});
```

Run: `cd frontend && npx vitest run components/ui/Loading.test.tsx` → FAIL (모듈 없음)

- [ ] **Step 2: 구현**

`frontend/lib/constants.ts` 끝에:

```ts
// 이 시간이 지나도 응답이 없으면 무료 서버가 잠들었다 깨는 중이라고 본다.
export const SLOW_MS = 4000;
```

`frontend/lib/messages.ts`의 `MSG_LOADING` 아래:

```ts
export const MSG_WAKING = "서버를 깨우는 중이에요. 최대 1분쯤 걸려요.";
```

`frontend/components/ui/Loading.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { SLOW_MS } from "@/lib/constants";
import { MSG_LOADING, MSG_WAKING } from "@/lib/messages";

// 이 컴포넌트가 화면에 붙은 뒤 SLOW_MS가 지났는지. 기다리는 동안에만 렌더하므로 붙은 시점이 곧 기다리기 시작한 시점이다.
function useSlow(): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, []);
  return slow;
}

export function Loading({ className = "py-10 text-center text-ink-mute" }: { className?: string }) {
  const slow = useSlow();
  return (
    <p role="status" className={className}>
      {slow ? MSG_WAKING : MSG_LOADING}
    </p>
  );
}

// 버튼처럼 이미 진행 표시가 있는 곳에 쓴다. 오래 걸릴 때만 이유를 덧붙인다.
export function SlowNote() {
  const slow = useSlow();
  if (!slow) return null;
  return (
    <p role="status" className="text-center text-sm text-ink-mute">
      {MSG_WAKING}
    </p>
  );
}
```

Run: `npx vitest run components/ui/Loading.test.tsx` → 2 passed

- [ ] **Step 3: 세 화면의 로딩 문구를 바꾼다**

`frontend/components/join/RoomGate.tsx`: import에서 `MSG_LOADING` 줄을 지우고 `import { Loading } from "@/components/ui/Loading";`을 더한다. 마지막 줄을 바꾼다:

```tsx
  return <Loading />;
```

`frontend/components/result/ResultScreen.tsx`: messages import에서 `MSG_LOADING`을 빼고 `import { Loading } from "@/components/ui/Loading";`을 더한다. `return <p className="py-10 text-center text-ink-mute">{MSG_LOADING}</p>;`를 바꾼다:

```tsx
    return <Loading />;
```

`frontend/components/hub/HubScreen.tsx`: `MSG_LOADING` import를 지우고 `Loading`을 import한다. `if (!rec) return <p ...>{MSG_LOADING}</p>;`를 바꾼다:

```tsx
  if (!rec) return <Loading />;
```

Run: `npx vitest run components/join components/result components/hub`
Expected: 전부 PASS. 기존 테스트는 처음 문구("불러오는 중이에요")를 `getByText`로 찾으므로 그대로 통과한다.

- [ ] **Step 4: 방 만들기 버튼 실패 테스트**

`frontend/components/room/CreateRoomForm.test.tsx` 끝에 추가 (상단 import에 `delay`를 msw에서 가져온다):

```tsx
test("만들기가 4초 넘게 걸리면 서버를 깨우는 중이라고 알린다", async () => {
  server.use(
    http.post(`${API}/rooms`, async () => {
      await delay("infinite");
      return HttpResponse.json(room());
    }),
  );
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
    fill("금요일 저녁", "2026-10-10");
    fireEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
    await screen.findByRole("button", { name: "만드는 중" });
    expect(screen.queryByText(/서버를 깨우는 중/)).toBeNull();
    await vi.advanceTimersByTimeAsync(4000);
    expect(screen.getByText("서버를 깨우는 중이에요. 최대 1분쯤 걸려요.")).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
```

Run: `npx vitest run components/room/CreateRoomForm.test.tsx` → 새 테스트 FAIL

- [ ] **Step 5: 방 만들기 버튼 구현**

`frontend/components/room/CreateRoomForm.tsx`: `import { SlowNote } from "@/components/ui/Loading";`을 더하고, 제출 버튼(`</button>`) 바로 아래에:

```tsx
        {create.isPending && <SlowNote />}
```

Run: `npx vitest run components/room` → 전부 PASS

- [ ] **Step 6: `docs/design.md` 8절에 행 추가**

"서버에 닿지 못함" 행 아래에:

```markdown
| 첫 응답이 4초 넘게 걸림 (무료 서버가 잠들었다 깨는 중) | "서버를 깨우는 중이에요. 최대 1분쯤 걸려요." (프론트 문구, `MSG_WAKING`) |
```

- [ ] **Step 7: 전체 확인과 커밋**

Run: `npm test && npm run lint && npx tsc --noEmit` → 119 passed, 오류 없음

```bash
git add frontend/components frontend/lib/constants.ts frontend/lib/messages.ts docs/design.md
git commit -m "feat: tell people the server is waking up when the first response is slow"
```

---

### Task 7: 배포 설정 파일, DB 연결 풀, RLS SQL, 문서

**Files:**
- Create: `render.yaml`, `.github/workflows/ci.yml`, `.github/workflows/cleanup.yml`, `backend/migrations/001_enable_rls.sql`, `backend/migrations/README.md`
- Modify: `backend/app/db.py`, `backend/tests/test_db.py`, `backend/scripts/cleanup_expired.py`(설명 주석), `.gitignore`, `backend/README.md`, `docs/design.md`, `CLAUDE.md`

**Interfaces:**
- Produces: Render 서비스 이름 `meetpoint-api`(주소는 `https://meetpoint-api.onrender.com` 형태, 이름이 이미 쓰이고 있으면 Render가 뒤에 글자를 붙인다). Task 8이 이 이름과 워크플로 이름 `ci`, `cleanup`을 쓴다.

- [ ] **Step 1: 연결 풀 실패 테스트**

`backend/tests/test_db.py` 끝에 추가 (import를 `from app.db import make_engine, normalize_database_url`로 바꾼다):

```python
def test_postgres_engine_uses_a_small_pool():
    # 세션 모드 풀러의 연결 수에 여유를 둔다. 인스턴스는 하나다. (엔진을 만들기만 하고 접속하지 않는다.)
    engine = make_engine("postgresql://u:p@localhost:5432/db")
    assert engine.pool.size() == 5
    assert engine.pool._max_overflow == 5


def test_sqlite_engine_is_unchanged():
    assert make_engine("sqlite://").dialect.name == "sqlite"
```

Run: `cd backend && .venv/Scripts/pytest tests/test_db.py -q`
Expected: 풀 테스트 FAIL (`_max_overflow`가 10)

- [ ] **Step 2: 구현**

`backend/app/db.py`의 `make_engine`을 바꾼다:

```python
POOL_SIZE = 5
POOL_MAX_OVERFLOW = 5


def make_engine(url: str) -> Engine:
    url = normalize_database_url(url)
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False}, pool_pre_ping=True)
    # Supabase 세션 모드 풀러에 붙는다. 서버 인스턴스가 하나라는 전제의 크기다.
    return create_engine(url, pool_pre_ping=True, pool_size=POOL_SIZE, max_overflow=POOL_MAX_OVERFLOW)
```

Run: `.venv/Scripts/pytest -q` → 284 passed

- [ ] **Step 3: `render.yaml`**

저장소 루트 `render.yaml`:

```yaml
# Render Blueprint. 화면에서 New > Blueprint로 이 저장소를 고르면 아래 서비스가 만들어진다.
# 무료 플랜은 15분 동안 요청이 없으면 잠든다. 유료로 올릴 때는 plan만 바꾼다.
services:
  - type: web
    name: meetpoint-api
    runtime: python
    plan: free
    region: singapore
    rootDir: backend
    buildCommand: pip install .
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    # CI(.github/workflows/ci.yml)가 통과한 커밋만 올린다.
    autoDeployTrigger: checksPass
    envVars:
      - key: PYTHON_VERSION
        value: 3.12.8
      # 아래 값은 저장소에 넣지 않는다. 서비스를 만들 때 화면에서 입력한다.
      - key: DATABASE_URL
        sync: false
      - key: KAKAO_REST_KEY
        sync: false
      - key: SEOUL_API_KEY
        sync: false
      - key: KOPIS_API_KEY
        sync: false
      - key: CORS_ORIGINS
        sync: false
```

- [ ] **Step 4: CI 워크플로**

`.github/workflows/ci.yml`:

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

# 같은 브랜치에 새 커밋이 오면 이전 실행을 멈춘다. 비공개 저장소의 실행 시간을 아낀다.
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/pyproject.toml
      - run: pip install -e ".[dev]"
      - run: pytest -q

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      # next-env.d.ts와 경로 타입은 커밋하지 않는다. 타입 검사 전에 만든다.
      - run: npx next typegen
      - run: npx tsc --noEmit
      - run: npm test
```

흐름 테스트(Playwright)는 넣지 않는다. 시간이 길고, 로컬에서 `npm run e2e`로 돌린다.

- [ ] **Step 5: 정리 워크플로와 스크립트 설명**

`.github/workflows/cleanup.yml`:

```yaml
name: cleanup

on:
  schedule:
    # 매일 03:17 (한국 시간). GitHub의 cron은 UTC다.
    - cron: "17 18 * * *"
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/pyproject.toml
      - run: pip install .
      # 만료된 방과 30일 넘은 콘텐츠 캐시를 지운다. 이 접속이 Supabase 무료 플랜의 일주일 무활동 정지도 막는다.
      - run: python -m scripts.cleanup_expired
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

`backend/scripts/cleanup_expired.py`의 맨 위 설명에서 "Railway cron에서 하루 한 번 실행한다."를 "GitHub Actions(`.github/workflows/cleanup.yml`)가 하루 한 번 실행한다."로 바꾼다.

- [ ] **Step 6: RLS SQL과 구조 변경 규칙**

`backend/migrations/001_enable_rls.sql`:

```sql
-- Supabase는 public 스키마의 표를 Data API로 내보낸다. 우리는 그 API를 쓰지 않는다.
-- 모든 표에 RLS를 켜고 정책을 만들지 않으면 anon, authenticated 역할은 아무 행도 읽거나 쓰지 못한다.
-- 백엔드는 postgres 역할로 접속하므로 영향을 받지 않는다.
-- scripts.init_db로 표를 만든 직후 한 번 실행한다. 여러 번 실행해도 된다.
alter table public.station_groups enable row level security;
alter table public.stations enable row level security;
alter table public.hubs enable row level security;
alter table public.station_times enable row level security;
alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.content_cache enable row level security;
alter table public.daily_stats enable row level security;
```

`backend/migrations/README.md`:

```markdown
# DB 구조 변경

마이그레이션 도구를 쓰지 않는다. 변경 SQL을 이 폴더에 번호 순서로 두고, 운영 DB(Supabase)에는 SQL 편집기에서 순서대로 실행한다.

## 규칙

- 파일 이름은 `NNN_설명.sql`. 한 번 운영에 적용한 파일은 고치지 않고 새 번호로 더한다.
- 모델(`app/models.py`)을 바꾸는 커밋에 SQL 파일을 함께 넣는다.
- 방, 참가자, 통계 표(`rooms`, `participants`, `daily_stats`)는 지우지 않는다. 열을 더할 때는 null을 허용하거나 기본값을 주어 기존 행이 깨지지 않게 한다.
- 역, 거점, 시간표, 콘텐츠 캐시(`station_groups`, `stations`, `hubs`, `station_times`, `content_cache`)는 `python -m pipeline.load`로 언제든 다시 적재할 수 있다.
- 새 표를 만들면 `001_enable_rls.sql`처럼 그 표에도 RLS를 켜는 문장을 같은 파일에 넣는다.
- SQL은 Postgres 기준으로 쓴다. 로컬 SQLite는 `dev.db`를 지우고 `scripts.init_db`로 다시 만든다.

## 새 DB를 만들 때

1. `python -m scripts.init_db` (현재 모델대로 모든 표 생성)
2. `001_enable_rls.sql` 실행
3. `python -m pipeline.load`

`init_db`가 최신 모델로 표를 만들기 때문에, 새 DB에는 그 뒤 번호의 열 추가 SQL을 실행할 필요가 없다. 번호가 붙은 변경 SQL은 이미 돌고 있는 DB를 따라오게 하는 용도다.

## 적용 기록

| 번호 | 운영 적용일 | 내용 |
|---|---|---|
| 001 | (첫 배포 때 적는다) | 모든 표에 RLS |
```

- [ ] **Step 7: `.gitignore`**

저장소 루트 `.gitignore`의 `.env` 줄을 다음 두 줄로 바꾼다. 운영 연결 문자열을 담는 `backend/.env.production` 같은 파일이 커밋되지 않게 한다:

```
.env
.env.*
!.env.example
```

Run: `git check-ignore -v backend/.env.production; git ls-files | grep env`
Expected: 첫 명령은 `.gitignore`의 `.env.*` 규칙을 보여주고, 두 번째는 `backend/.env.example`과 `frontend/.env.example`만 나온다.

- [ ] **Step 8: 문서**

`backend/README.md`:
- "## 배포 (Railway)" 절 전체를 아래로 바꾼다.

```markdown
## 배포 (Render)

설계와 순서는 `docs/deploy-design.md`. 서비스 정의는 저장소 루트의 `render.yaml`이다.

- 무료 플랜, 싱가포르. 15분 동안 요청이 없으면 잠들고 깨는 데 약 1분 걸린다. UptimeRobot이 5분마다 `/health`를 불러 깨워둔다.
- 파이썬 버전은 `render.yaml`의 `PYTHON_VERSION`(3.12.8)이다.
- `main`에 올라간 커밋 중 CI(`.github/workflows/ci.yml`)가 통과한 것만 자동으로 배포된다.
- DB는 Supabase의 세션 모드 연결 문자열(`...pooler.supabase.com:5432`)을 쓴다. 직접 연결은 IPv6 전용이라 Render와 가정용 인터넷에서 닿지 않는다. 트랜잭션 모드(6543)는 쓰지 않는다.
- 새 DB를 만드는 순서와 구조 변경 규칙은 `migrations/README.md`.
- 역 데이터를 다시 적재한 뒤에는 서비스를 재시작한다. 시간표를 프로세스 메모리에 올리기 때문이다. 적재 후 기존 방의 참가자 출발역 id가 바뀔 수 있으니 적재는 사용량이 적을 때 한다.
- `/health`는 DB를 건드리지 않는다. 헬스체크가 DB 장애에 끌려가지 않는다.
```

- "## 운영" 절의 "만료 방 정리" 줄을 바꾼다: "만료 방 정리: GitHub Actions의 `cleanup` 워크플로가 하루 한 번 `python -m scripts.cleanup_expired`를 실행한다. 만료된 방과 30일 넘은 콘텐츠 캐시를 함께 지운다. 수동 실행은 `gh workflow run cleanup`."
- 환경 변수 표의 `DATABASE_URL` 설명 끝 문장을 "Supabase는 세션 모드(`pooler.supabase.com:5432`) 문자열을 쓴다."로 바꾼다.

`docs/design.md`:
- 기술 스택 표와 구성 그림, 구성 요소 표에서 `Railway`를 `Render`로 바꾼다 (3곳: 29행 근처는 그대로, 52행의 그림, 65행의 표).
- 문서 맨 위 "상태" 줄을 "백엔드, 데이터, 프론트엔드 구현 완료. 배포 준비 중 (`docs/deploy-design.md`)"으로 바꾼다.

`CLAUDE.md`:
- "문서를 먼저 읽을 것" 목록에 한 줄을 더한다: "- `docs/deploy-design.md`: 배포 구성(Vercel, Render, Supabase), 단계별 출시 계획, DB 구조 변경 규칙".
- "규약"의 "마이그레이션 도구 없음. 스키마가 바뀌면 테이블을 지우고 `init_db`부터." 줄을 바꾼다: "마이그레이션 도구 없음. 로컬은 `dev.db`를 지우고 `init_db`부터. 운영 DB는 지우지 않고 `backend/migrations/`에 SQL을 더해 적용한다 (`backend/migrations/README.md`)."
- 백엔드 아키텍처 절 끝에 한 줄을 더한다: "규모 통계는 `app/stats.py`의 `bump`가 `daily_stats`에 날짜별 개수만 올린다(한국 날짜). 본 작업의 커밋 뒤에 부르고 실패해도 요청을 깨지 않는다. 개인 정보를 넣지 않는다."

- [ ] **Step 9: 금지 문자 검사**

```bash
python - <<'EOF'
import io, subprocess
files = subprocess.run(["git", "ls-files", "-m", "-o", "--exclude-standard"], capture_output=True, text=True).stdout.split()
for f in files:
    try:
        s = io.open(f, encoding="utf-8").read()
    except (UnicodeDecodeError, FileNotFoundError):
        continue
    n = s.count(chr(0x2014)) + s.count(chr(0x00B7))
    if n:
        print(f, n)
print("checked", len(files))
EOF
```

Expected: `checked N`만 출력된다. `CLAUDE.md`가 1건으로 나오면 금지 문자 두 개를 이름으로 말하는 규칙 문장 자체이므로 넘어간다.

- [ ] **Step 10: 전체 확인, 커밋, CI 실제 실행**

Run: `cd backend && .venv/Scripts/pytest -q` → 284 passed
Run: `cd frontend && npm test && npm run lint && npx tsc --noEmit` → 통과

```bash
git add render.yaml .github backend/migrations backend/app/db.py backend/tests/test_db.py backend/scripts/cleanup_expired.py .gitignore backend/README.md docs/design.md CLAUDE.md
git commit -m "ci: add Render blueprint, CI and daily cleanup workflows, RLS migration and deploy docs"
git push -u origin feat/deploy
gh pr create --base main --head feat/deploy --title "feat: deployment stage 1 (free tier)" --body-file <PR 본문 파일>
gh pr checks --watch
```

PR 본문에는 요약, 확인한 것(테스트 수), 남은 일(Task 8의 실제 배포)을 적는다. 끝에 Claude Code 생성 문구를 넣는다.

Expected: `backend`와 `frontend` 두 검사가 모두 통과한다. 로컬은 Windows와 Python 3.14, CI는 Linux와 Python 3.12라 여기서 처음 드러나는 실패가 있을 수 있다. 실패하면 로그를 읽고 원인을 고친다(테스트를 건너뛰게 하지 않는다). `npx next typegen`이 없는 명령이라고 나오면 `npx next build`로 타입을 만드는 방법으로 바꾸지 말고, 먼저 `npx next --help`로 현재 버전의 타입 생성 명령을 확인한다.

---

### Task 8: 실제 배포와 운영 점검 (사용자와 함께)

이 태스크는 코드가 아니라 절차다. 계정 생성, 비밀 값 입력, 화면 클릭은 사용자가 하고, 명령 실행과 확인은 진행자가 한다. 서브에이전트에게 맡기지 않는다. 비밀 값은 채팅에 붙여 넣지 않게 안내하고, 진행자는 값의 길이만 확인한다.

**Files:**
- Create (커밋하지 않음): `backend/.env.production` (사용자가 Supabase 연결 문자열을 넣는 파일)
- Modify: `backend/migrations/README.md`(적용 기록), `dev/active/deploy/deploy-context.md`, `dev/active/deploy/deploy-tasks.md`, `docs/deploy-design.md`(실제 주소와 점검 결과)

**Interfaces:**
- Consumes: `render.yaml`의 서비스 `meetpoint-api`, 워크플로 `ci`와 `cleanup`, `backend/migrations/001_enable_rls.sql`, `python -m scripts.stats`.

- [ ] **Step 1: PR 병합**

Task 7의 PR이 CI를 통과했는지 확인하고 사용자에게 병합 여부를 묻는다. 병합하면 `main`에 `render.yaml`과 워크플로가 올라간다. 예약 워크플로(`cleanup`)는 기본 브랜치에 있어야 동작한다.

- [ ] **Step 2: Supabase 프로젝트 (사용자)**

사용자에게 안내한다:
1. https://supabase.com 에서 GitHub 계정으로 가입, New project.
2. 이름 `meetpoint`, 지역 `Southeast Asia (Singapore)`, DB 비밀번호는 생성기로 만들고 따로 보관. 비밀번호에 `@`, `/`, `:`, `#` 같은 기호가 있으면 연결 문자열이 깨지므로 영문과 숫자만으로 만든다.
3. 프로젝트가 만들어지면 위쪽 Connect 버튼, Session pooler 항목의 문자열(`postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-...pooler.supabase.com:5432/postgres`)을 복사해 `[YOUR-PASSWORD]`를 실제 비밀번호로 바꾼다.
4. `backend/.env.production` 파일을 만들어 한 줄을 넣는다: `DATABASE_URL=<그 문자열>`. 진행자가 빈 파일을 만들어 메모장으로 열어준다.

진행자 확인 (값을 출력하지 않는다):

```bash
cd backend && awk -F= '/^DATABASE_URL/{print "length", length($2); print (index($2,"pooler.supabase.com:5432")>0 ? "session pooler ok" : "NOT session pooler")}' .env.production
git status --short | grep -c "env.production"
```

Expected: `session pooler ok`, 두 번째 명령은 `0` (git이 무시함).

- [ ] **Step 3: 표 만들기, RLS, 적재 (진행자)**

```bash
cd backend
export DATABASE_URL="$(grep ^DATABASE_URL= .env.production | cut -d= -f2-)"
.venv/Scripts/python -m scripts.init_db
.venv/Scripts/python - <<'EOF'
from pathlib import Path
from sqlalchemy import text
from app.db import engine
lines = Path("migrations/001_enable_rls.sql").read_text(encoding="utf-8").splitlines()
sql = "\n".join(line for line in lines if not line.strip().startswith("--"))
with engine.begin() as conn:
    for statement in [s.strip() for s in sql.split(";") if s.strip()]:
        conn.execute(text(statement))
    rows = conn.execute(text("select tablename, rowsecurity from pg_tables where schemaname='public' order by 1")).all()
for name, rls in rows:
    print(name, rls)
EOF
.venv/Scripts/python -m pipeline.load
.venv/Scripts/python -m scripts.stats
unset DATABASE_URL
```

Expected: `tables created`, 표 8개가 모두 `True`, 적재 개수(station_groups 646, stations 791, hubs 100, station_times 124978), 통계 `total 0 0 0`. `export`한 값은 이 셸에만 남고 `unset`으로 지운다. 표 중 하나라도 `False`면 그 표의 `alter table` 문장을 다시 실행하고 원인을 기록한다.

사용자에게 안내: Supabase의 Project Settings, Data API에서 Data API를 끈다(메뉴 이름이 다르면 "Expose schema"에서 `public`을 뺀다). 끈 뒤 표 편집기에서 표가 보이는지 확인한다.

`backend/migrations/README.md`의 적용 기록 표에 001의 적용일을 적는다.

- [ ] **Step 4: Render 서비스 (사용자)**

1. https://render.com 에서 GitHub 계정으로 가입.
2. New, Blueprint, `jiwon026/meetpoint` 저장소를 연결(비공개 저장소라 GitHub 앱 권한을 요청한다. 이 저장소만 허용).
3. `render.yaml`을 읽고 `meetpoint-api`가 보인다. 값을 묻는 다섯 칸을 채운다: `DATABASE_URL`(Step 2의 문자열), `KAKAO_REST_KEY`, `SEOUL_API_KEY`, `KOPIS_API_KEY`(셋은 `backend/.env`에 있는 값), `CORS_ORIGINS`는 우선 `http://localhost:3000`.
4. Apply. 첫 빌드는 몇 분 걸린다. 결제 정보를 요구하면 멈추고 진행자에게 알린다(무료 플랜은 요구하지 않아야 한다).

진행자 확인 (`<api>`는 Render가 보여주는 서비스 주소):

```bash
curl -s https://<api>/health
curl -s "https://<api>/stations?q=강남" | head -c 200
```

Expected: `{"ok":true}`, 강남 역 목록 JSON. 실패하면 Render의 Logs를 사용자에게 보여달라고 하거나 화면을 같이 본다. 흔한 원인: 연결 문자열의 비밀번호 기호, 세션 모드가 아닌 문자열, 빌드에서 파이썬 버전 오류.

- [ ] **Step 5: Vercel 프로젝트 (사용자)**

1. https://vercel.com 에서 GitHub 계정으로 가입, Add New, Project, `meetpoint` 저장소 Import.
2. Root Directory를 `frontend`로 지정. Framework는 Next.js로 자동 인식된다.
3. Environment Variables에 두 개를 넣는다: `NEXT_PUBLIC_API_BASE` = `https://<api>`(끝에 `/` 없이), `NEXT_PUBLIC_KAKAO_JS_KEY` = `frontend/.env.local`에 있는 값.
4. Deploy. 끝나면 주소(`https://<프로젝트>.vercel.app`)를 진행자에게 알려준다. 주소는 비밀이 아니다.

이 값들은 빌드할 때 화면 코드에 들어간다. 나중에 바꾸면 다시 배포(Redeploy)해야 반영된다.

- [ ] **Step 6: 주소 연결 (사용자와 진행자)**

1. 사용자: Render의 `meetpoint-api`, Environment에서 `CORS_ORIGINS`를 `https://<프로젝트>.vercel.app`으로 바꾸고 저장(자동 재배포). 로컬 개발에서 운영 백엔드를 부를 일은 없으므로 localhost는 넣지 않는다.
2. 사용자: 카카오 개발자 콘솔의 JavaScript 키 SDK 도메인에 `https://<프로젝트>.vercel.app`을 추가한다. `http://localhost:3000`은 그대로 둔다.
3. 진행자 확인:

```bash
curl -s -i -H "Origin: https://<프로젝트>.vercel.app" https://<api>/health | grep -i "access-control-allow-origin"
curl -s -i -H "Origin: https://example.com" https://<api>/health | grep -ci "access-control-allow-origin"
```

Expected: 첫 줄에 Vercel 주소가 보이고, 두 번째는 `0`.

- [ ] **Step 7: 정리 작업과 깨우기**

진행자 (값을 출력하지 않고 secret을 넣는다):

```bash
cd backend && grep ^DATABASE_URL= .env.production | cut -d= -f2- | gh secret set DATABASE_URL --repo jiwon026/meetpoint
gh workflow run cleanup --repo jiwon026/meetpoint
sleep 20; gh run list --workflow cleanup --repo jiwon026/meetpoint --limit 1
gh run watch --repo jiwon026/meetpoint $(gh run list --workflow cleanup --repo jiwon026/meetpoint --limit 1 --json databaseId -q '.[0].databaseId')
```

Expected: 실행이 성공하고 로그에 `deleted 0 expired rooms`가 보인다.

사용자: https://uptimerobot.com 가입, Add New Monitor, 종류 HTTP(s), URL `https://<api>/health`, 간격 5분, 알림은 본인 이메일. 이 단계는 Step 8의 "잠든 서버" 점검을 한 뒤에 한다.

- [ ] **Step 8: 운영 점검 (`docs/deploy-design.md` 5절)**

진행자가 브라우저 도구로 운영 주소에서 직접 확인하고, 휴대폰 확인은 사용자에게 부탁한다. 결과를 `dev/active/deploy/deploy-context.md`에 항목별로 적는다.

1. 잠든 서버: UptimeRobot을 붙이기 전, 20분 넘게 아무 요청도 보내지 않은 뒤 운영 주소의 첫 화면에서 방을 만든다. 4초 뒤 "서버를 깨우는 중이에요" 문구가 보이고 약 1분 안에 참여 화면으로 넘어가는지.
2. 전체 흐름: 방 만들기, 역 검색으로 1명, 주소 검색으로 1명 등록, 추천 5곳, 지역과 테마 필터, 지도와 출발역 점선, 주변 화면의 맛집과 카페, 카카오맵 링크.
3. 행사 탭: 서울 거점 하나와 경기 거점 하나. 싱가포르에서 서울시와 KOPIS가 응답하는지. 막히면 화면에 "지금 불러올 수 없어요"가 보이는지 확인하고, 상태 코드와 응답 종류(내용은 빼고)를 기록한다. 대응은 따로 결정한다.
4. 날짜 검증:

```bash
curl -s -X POST https://<api>/rooms -H "Content-Type: application/json" -d '{"title":"check","meet_date":"2020-01-01"}'
curl -s -X POST https://<api>/rooms -H "Content-Type: application/json" -d '{"title":"check","meet_date":"2029-01-01"}'
```

Expected: 각각 `{"detail":"오늘 이후 날짜를 골라주세요"}`, `{"detail":"약속 날짜는 1년 안으로 골라주세요"}`.

5. 로그: 사용자가 Render Logs 화면을 보여주거나 내용을 확인한다. `/stations` 줄에 `?q=`가 없고, `dapi.kakao.com`이나 `openapi.seoul.go.kr`이 들어간 줄이 없어야 한다.
6. 검색 차단:

```bash
curl -s https://<프로젝트>.vercel.app/robots.txt
curl -s https://<프로젝트>.vercel.app/r/<만든 방의 slug> | grep -o '<meta name="robots"[^>]*>'
```

7. 통계: 로컬에서 `DATABASE_URL`을 Step 3처럼 잠깐 내보내고 `python -m scripts.stats`. 점검하며 만든 방과 참가자 수가 오늘 날짜(한국 시간) 행에 맞게 잡혔는지.
8. 휴대폰(사용자): 같은 흐름을 한 번, 지도 위에서 손가락으로 쓸어내릴 때 불편한지.

문제가 나오면 고치고(작은 수정은 바로, 큰 것은 사용자와 상의) 다시 확인한다. 점검에서 만든 방은 약속 날짜 7일 뒤에 지워진다.

- [ ] **Step 9: 기록과 마무리**

- `docs/deploy-design.md`: 상태 줄을 "1단계 배포 완료 (날짜)"로, 실제 프론트 주소와 백엔드 주소를 2.1절 표에 적는다. 행사 API 점검 결과를 8절에 적는다.
- `dev/active/deploy/deploy-context.md`: 점검 결과, 배포하며 내린 결정, 남은 문제, 2단계에 넘길 것.
- `dev/active/deploy/deploy-tasks.md`: 체크.
- `CLAUDE.md`의 프로젝트 설명 아래에 운영 주소 한 줄.

```bash
git add docs dev CLAUDE.md backend/migrations/README.md
git commit -m "docs: record the stage 1 deployment and smoke test results"
git push
```

`backend/.env.production`은 지우지 않아도 되지만(무시됨) 사용자에게 그 파일에 운영 DB 비밀번호가 있다는 것을 알린다.

---

## Self-Review 결과

- 설계 3.1(날짜) Task 1, 3.2(로그) Task 2, 3.3(카카오) Task 3, 3.6(통계) Task 4, 3.4(방 페이지) Task 5, 3.5(깨우는 중) Task 6, 3.7(연결 풀과 RLS)과 3.8(구조 변경 규칙)과 4.1(파일) Task 7, 4.2(순서)와 5절(점검) Task 8.
- 2단계와 3단계(설계 6절, 7절)는 이 계획의 범위가 아니다.
- 이름 확인: `kst_date`(Task 1에서 만들고 Task 4에서 씀), `json_object`(Task 3), `bump`와 `StatColumn`(Task 4), `roomMetadata`(Task 5), `Loading`과 `SlowNote`(Task 6), 서비스 이름 `meetpoint-api`와 워크플로 `ci`, `cleanup`(Task 7에서 만들고 Task 8에서 씀).
- 테스트 수는 태스크를 순서대로 했을 때의 예상이다. 중간에 테스트를 더하거나 나누면 달라질 수 있으니, 숫자가 다르면 실패가 없는지를 기준으로 본다.
