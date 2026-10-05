# 배포 설계

작성: 2026-10-05
상태: 설계 확정, 구현 전. 구현 계획은 `dev/active/deploy/deploy-plan.md`.

## 0. 한 줄 요약

무료 구간으로 먼저 올려 지인끼리 써보고(1단계), 괜찮으면 홍보하며 데이터를 쌓고(2단계), 그 결과를 포트폴리오로 정리한다(3단계). 이 문서는 1단계를 구현 수준으로, 2단계와 3단계를 방향 수준으로 정한다.

## 1. 확정한 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 출시 순서 | 지인 테스트, 홍보, 포트폴리오 공개 | 단계마다 필요한 것만 넣는다 |
| 로그인 | 만들지 않는다 | 링크를 받은 사람이 바로 참여하는 흐름이 핵심이고, 계정에 쌓아둘 장기 데이터가 없다. 남을 빼버리는 문제가 실제로 나오면 참가자 본인 토큰으로 푼다 |
| 비용 | 무료 구간으로 시작, 홍보 단계에서 백엔드를 유료로 | 지인 테스트에 돈을 쓸 이유가 없다 |
| 프론트 | Vercel Hobby | Next.js 기본 배포처. 개인, 비상업 용도 조건 |
| 백엔드 | Render 무료 웹 서비스, 싱가포르 | 한국에서 가장 가까운 무료 지역. 이전 문서의 Railway는 무료 구간이 없어 바꾼다 |
| DB | Supabase 무료, 싱가포르 | 백엔드와 같은 지역. 사용자는 DB에 직접 닿지 않으므로 백엔드와의 거리가 중요하다 |
| 주소 | `*.vercel.app` 무료 주소 | 자체 도메인은 홍보 전에 결정한다 |
| 통계 1단계 | 서버가 날짜별 개수만 센다 | 방이 지워져도 숫자는 남고 개인 정보는 없다 |
| 통계 2단계 | Amplitude, 익명 이벤트만 | 퍼널 분석. 홍보 전에 붙여 지인 사용으로 검증한 뒤 홍보를 시작한다 |
| 깨우기와 장애 알림 | UptimeRobot 무료, 5분 간격 | Render 무료 서비스는 15분 뒤 잠들고 깨는 데 약 1분 걸린다 |
| 만료 방 삭제 | GitHub Actions 예약 실행, 하루 한 번 | Render 무료에는 cron이 없다. 저장소가 비공개라 월 2,000분 한도가 있지만 하루 1분이면 충분하다 |
| DB 구조 변경 | 마이그레이션 도구 없이 SQL 파일을 순서대로 적용 | 표가 적고 변경이 드물다. 역과 거점 표는 언제든 다시 적재하고, 방과 통계 표는 지우지 않는다 |

확인한 사실 (2026-10-05, 각 서비스 문서):

- Render 무료: 15분 동안 들어오는 요청이 없으면 잠든다. 깨는 데 약 1분. 작업 공간당 월 750시간. cron 없음. 지역은 oregon, ohio, virginia, frankfurt, singapore.
- Render 파이썬 버전: 환경 변수 `PYTHON_VERSION`(전체 버전 필요)이 가장 우선이고, 없으면 `.python-version`, 그것도 없으면 기본 3.14.3.
- Supabase 무료: DB 500MB(현재 데이터 약 10MB), 일주일 동안 활동이 없으면 일시 정지, 프로젝트 2개.
- Supabase 연결: 직접 연결은 IPv6 전용이다. IPv4만 되는 호스트(Render)와 가정용 인터넷에서는 Supavisor 세션 모드(`...pooler.supabase.com:5432`)를 쓴다. 세션 모드는 prepared statement를 지원한다. 트랜잭션 모드(6543)는 쓰지 않는다.
- Vercel Hobby: 개인, 비상업 용도만. 하루 배포 100회.

## 2. 구성

```
[브라우저]
   |  화면                         |  API 호출 (CORS)
   v                               v
[Vercel: Next.js]  --제목 조회-->  [Render: FastAPI, 싱가포르]  --SQL-->  [Supabase Postgres, 싱가포르]
                                       ^                 |
[UptimeRobot] --5분마다 /health--------+                 +--> 카카오, 서울시, KOPIS API
[GitHub Actions] --하루 한 번 정리 스크립트--------------------------------> [Supabase]
```

- 브라우저가 백엔드를 직접 부른다(지금과 같다). Vercel 서버가 백엔드를 부르는 곳은 방 페이지의 제목 조회 하나뿐이다.
- `git push`로 `main`이 바뀌면 Vercel과 Render가 각자 새 버전을 올린다. Render는 CI 검사가 통과한 커밋만 올린다(`autoDeployTrigger: checksPass`).

### 2.1 환경 변수

| 위치 | 변수 | 값 |
|---|---|---|
| Render | `DATABASE_URL` | Supabase 세션 모드 연결 문자열 |
| Render | `KAKAO_REST_KEY`, `SEOUL_API_KEY`, `KOPIS_API_KEY` | 각 키 |
| Render | `CORS_ORIGINS` | 프론트의 운영 주소 (예: `https://meetpoint.vercel.app`) |
| Render | `PYTHON_VERSION` | `3.12.8` (`render.yaml`에 적는다) |
| Vercel | `NEXT_PUBLIC_API_BASE` | Render 서비스 주소 (예: `https://meetpoint-api.onrender.com`) |
| Vercel | `NEXT_PUBLIC_KAKAO_JS_KEY` | 카카오 JavaScript 키 |
| GitHub Actions secret | `DATABASE_URL` | Render와 같은 값 |

비밀 값은 각 서비스의 화면에서 사용자가 직접 넣는다. 저장소에는 넣지 않는다. `NEXT_PUBLIC_`으로 시작하는 값은 브라우저에 노출되는 값이다.

Vercel의 미리보기 배포(브랜치마다 생기는 임시 주소)는 `CORS_ORIGINS`에 없어서 운영 백엔드를 부르지 못한다. 1단계에서는 그대로 둔다.

### 2.2 카카오 콘솔

JavaScript 키의 SDK 도메인에 운영 주소를 추가한다. `http://localhost:3000`은 그대로 둔다. 주소를 바꾸면 다시 등록한다.

## 3. 1단계: 올리기 전에 코드로 고칠 것

### 3.1 약속 날짜 서버 검증

- `POST /rooms`가 지난 날짜와 1년(365일) 넘는 미래 날짜를 422로 거절한다. 문구는 프론트와 같은 "오늘 이후 날짜를 골라주세요", 상한은 "약속 날짜는 1년 안으로 골라주세요".
- "오늘"은 한국 시간 기준이다. 서버는 UTC로 돌기 때문에 `utcnow()`에 9시간을 더해 날짜를 구한다.
- 검증은 스키마가 아니라 `rooms/service.py`에서 한다. 서비스의 시계(`utcnow`)를 테스트가 고정하고 있어서 같은 시계를 써야 한다.
- 프론트의 날짜 입력에도 `max`를 둔다. 흐름 테스트가 쓰는 2030년 날짜는 실행 시점 기준 상대 날짜로 바꾼다.
- 이유: 지금은 먼 미래 날짜를 넣으면 "약속 7일 뒤 삭제"가 사실상 무기한 보관이 된다.

### 3.2 로그에 주소와 검색어를 남기지 않기

- 앱 시작 때 로깅을 명시적으로 설정한다: 루트 INFO, `httpx`와 `httpcore`는 WARNING. httpx는 INFO에서 요청 URL 전체(주소 검색어, API 키 포함)를 남긴다.
- uvicorn 접근 로그는 경로와 쿼리를 남긴다. 주소는 본문으로만 보내므로(`POST /places/search`, `POST /rooms/{slug}/participants`) 접근 로그에 들어가지 않는다. 역 검색(`GET /stations?q=`)의 검색어는 남는다. 역 이름은 개인 정보가 아니지만 사용자가 그 칸에 주소를 잘못 칠 수 있으므로, 접근 로그에서 쿼리 문자열을 지우는 필터를 건다.

### 3.3 카카오가 JSON이 아닌 200을 줄 때

- 행사 API에서 고친 것과 같은 종류다. `KakaoGeocoder`와 `KakaoLocalClient`가 JSON이 아닌 본문이나 예상 밖 모양을 받으면 `UpstreamError`를 던진다.
- 라우터는 `UpstreamError`를 이미 `httpx.HTTPError`와 같이 다룬다. 장소 검색 프록시와 참가자 등록 경로에서 빠진 곳이 있으면 맞춘다(주소 등록은 503과 안내 문구, 장소 검색과 콘텐츠는 200과 `error`).

### 3.4 방 페이지

- `/r/*`에 `robots: noindex, nofollow` 메타데이터. `app/robots.ts`로 `/r/`를 막는다. 방 링크가 검색 엔진에 잡히면 안 된다.
- `app/r/[slug]/layout.tsx`의 제목 조회에 3초 타임아웃과 `encodeURIComponent`. 지금은 백엔드가 잠들어 있으면 페이지 자체가 최대 1분 동안 뜨지 않는다. 타임아웃이 나면 기본 제목으로 넘어간다.

### 3.5 서버가 깨어나는 동안의 안내

- 첫 조회가 4초 넘게 걸리면 "불러오는 중이에요" 대신 "서버를 깨우는 중이에요. 최대 1분쯤 걸려요."를 보인다. 방 화면(`RoomGate`), 추천 화면, 주변 화면, 방 만들기 버튼에 같은 규칙을 둔다.
- TanStack Query의 재시도는 그대로 둔다. Render는 깨는 동안 요청을 붙잡고 있다가 응답하므로 보통 오류 없이 늦게 성공한다.

### 3.6 규모 통계

표 `daily_stats`:

| 열 | 뜻 |
|---|---|
| `day` (기본 키, 날짜) | 한국 시간 기준 날짜 |
| `rooms_created` | 만든 방 수 |
| `participants_added` | 등록한 참가자 수 (빼기와 다시 넣기는 세지 않는다) |
| `rooms_with_result` | 추천이 처음 나온 방 수 |

- 대화에서는 "추천 조회 수"라고 했지만 그대로는 셀 수 없다. 추천 화면이 10초마다 다시 불러서 조회 수가 사람 수와 무관하게 불어난다. 대신 "추천까지 간 방 수"를 센다: `rooms.first_result_at`(null 가능)을 두고, 결과가 처음 `ready`로 계산될 때 시각을 적으면서 그날의 `rooms_with_result`를 1 올린다.
- 방당 평균 인원은 `participants_added / rooms_created`, 추천 도달률은 `rooms_with_result / rooms_created`로 구한다.
- 증가는 SQLite와 Postgres에서 같이 도는 방식으로 한다: `UPDATE ... SET n = n + 1 WHERE day = ?`, 바뀐 행이 없으면 `INSERT`, 동시에 들어와 `INSERT`가 충돌하면 `UPDATE`를 다시 한다.
- 통계 기록이 실패해도 요청은 성공해야 한다. 예외를 잡아 경고 로그만 남긴다.
- 닉네임, 좌표, 역, 슬러그는 넣지 않는다.
- 읽기: `python -m scripts.stats`가 날짜별 표와 합계를 출력한다. 공개 API는 만들지 않는다. Supabase 화면에서 표를 직접 봐도 된다.

### 3.7 DB 연결과 보안

- `make_engine`에 Postgres일 때 `pool_size=5`, `max_overflow=5`를 준다. 세션 모드 풀의 연결 수에 여유를 둔다.
- Supabase는 `public` 스키마의 표를 Data API(PostgREST)로 내보낸다. 우리는 이 API를 쓰지 않으므로 프로젝트 설정에서 Data API를 끄고, 모든 표에 RLS를 켠다(정책 없음). 백엔드는 `postgres` 역할로 접속해 RLS의 영향을 받지 않는다. RLS를 켜는 SQL은 `backend/migrations/`에 둔다.

### 3.8 DB 구조 변경 규칙

- `backend/migrations/NNN_설명.sql`에 변경 SQL을 번호 순서로 둔다. 운영 DB에는 Supabase SQL 편집기에서 순서대로 실행한다. 새 DB는 `scripts.init_db`로 만든 뒤 RLS SQL만 실행한다.
- 역, 거점, 시간표, 콘텐츠 캐시는 `pipeline.load`로 언제든 다시 적재한다.
- 방, 참가자, 통계 표는 지우지 않는다. 열 추가는 null 허용이나 기본값을 주어 기존 행이 깨지지 않게 한다.
- 모델과 SQL이 어긋나지 않게, 모델을 바꾸는 커밋에 SQL 파일을 함께 넣는다.
- 표가 늘거나 변경이 잦아지면 Alembic으로 옮긴다.

## 4. 1단계: 올리기

### 4.1 저장소에 넣을 파일

- `render.yaml`: 웹 서비스 하나. `runtime: python`, `plan: free`, `region: singapore`, `rootDir: backend`, `buildCommand: pip install .`, `startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT`, `healthCheckPath: /health`, `autoDeployTrigger: checksPass`, 비밀 값은 `sync: false`.
- `.github/workflows/ci.yml`: push와 PR에서 백엔드 `pytest`(Python 3.12), 프론트 `npm test`, `npm run lint`, `npx tsc --noEmit`. 흐름 테스트(Playwright)는 시간이 길어 CI에 넣지 않고 로컬에서 돌린다.
- `.github/workflows/cleanup.yml`: 매일 한국 시간 새벽에 `python -m scripts.cleanup_expired`. 수동 실행도 가능하게 한다. 실패하면 GitHub가 메일로 알린다. 이 실행이 Supabase의 일주일 무활동 정지도 막는다.
- Vercel은 설정 파일 없이 화면에서 루트 디렉터리를 `frontend`로 지정한다.

### 4.2 순서

1. Supabase 프로젝트 생성(싱가포르), 세션 모드 연결 문자열 확보.
2. 로컬에서 `DATABASE_URL`을 Supabase로 두고 `scripts.init_db`, RLS SQL, `pipeline.load`. Data API 끄기.
3. Render에 `render.yaml`로 서비스 생성, 환경 변수 입력. `/health`와 `/stations?q=강남` 확인.
4. Vercel 프로젝트 생성, 환경 변수 입력, 배포.
5. Render의 `CORS_ORIGINS`를 Vercel 주소로, 카카오 콘솔에 Vercel 주소 등록.
6. GitHub secret `DATABASE_URL` 등록, 정리 작업을 수동으로 한 번 실행.
7. UptimeRobot에 `/health` 모니터 등록.
8. 운영 점검(5절).

계정 생성과 비밀 값 입력은 사용자가 한다. 단계마다 무엇을 누를지 안내한다.

## 5. 운영 점검 (올린 직후)

- 휴대폰과 PC에서: 방 만들기, 링크로 참여(역 검색과 주소 검색), 2명 이상 등록, 추천 5곳, 지역과 테마 필터, 지도와 출발역 점선, 주변 화면의 맛집과 카페.
- 행사 탭: 서울 거점과 경기 거점 각각. 서울시와 KOPIS가 해외(싱가포르)에서 오는 요청을 막을 수 있다. 막히면 행사 탭만 "지금 불러올 수 없어요"로 두고 원인과 선택지(국내 경유, 미리 받아 저장)를 기록한 뒤 따로 결정한다. 나머지 기능은 카카오라 영향이 없다.
- 지난 날짜와 2년 뒤 날짜로 방 만들기가 거절되는지.
- Render 로그에 주소, 검색어, API 키가 없는지.
- 방 페이지의 `robots` 메타 태그와 `/robots.txt`.
- 서버를 잠들게 둔 뒤(UptimeRobot 등록 전) 첫 접속에서 안내 문구가 보이고 약 1분 안에 화면이 뜨는지.
- `daily_stats`에 오늘 행이 생기고 숫자가 맞는지.
- 정리 작업 수동 실행이 성공하는지.

## 6. 2단계(홍보)에 할 것

순서대로:

1. Amplitude 연결과 검증. 자동 수집(페이지 주소, 세션 리플레이)을 끄고 직접 정한 이벤트만 보낸다. 보내는 값은 지역, 테마, 참여 인원, 열어본 순위 같은 익명 값뿐이다. 닉네임, 역 이름, 검색어, 슬러그, 좌표는 보내지 않는다. IP 저장을 끈다. 지인 사용으로 며칠 검증한 뒤 홍보를 시작한다.
2. 개인정보 안내 페이지: 저장하는 것(뭉갠 좌표, 닉네임, 7일 뒤 삭제), 익명 통계와 Amplitude(국외 이전) 고지.
3. 호출 제한: 방 만들기와 장소 검색 프록시에 IP 기준 제한. 프록시는 익명으로 카카오 할당량을 쓴다.
4. 카카오톡 공유 미리보기(Open Graph 이미지와 문구).
5. 백엔드를 유료로 올려 잠들지 않게 한다. `render.yaml`의 `plan`만 바꾼다.
6. 자체 도메인을 쓸지 결정하고, 쓴다면 홍보 전에 바꾼다.
7. 참가자 본인 토큰(남이 빼지 못하게): 지인 테스트에서 불편이 확인되면.
8. 오류 감시(Sentry 등)와 카카오 할당량 확인.

## 7. 3단계(포트폴리오)에 할 것

`daily_stats`와 Amplitude의 수치를 정리하고, README와 소개 문서에 문제, 해결, 결과 숫자를 적는다. 저장소를 공개로 바꾼다면 그 전에 커밋 기록에 비밀 값이 없는지 다시 훑는다.

## 8. 알려진 한계

- 무료 Render는 UptimeRobot이 깨워두는 동안에만 빠르다. UptimeRobot이 멈추거나 배포 직후에는 첫 접속이 약 1분 걸린다.
- 역간 시간표는 프로세스가 뜬 뒤 첫 결과 요청 때 DB에서 읽어 메모리에 올린다(약 12만 5천 행). 배포 직후 첫 추천 조회가 몇 초 더 걸린다.
- 정리 작업은 하루 한 번이라 만료된 방의 데이터가 최대 하루 더 남는다. 만료된 방은 API가 이미 410으로 막는다.
- 통계는 한국 시간 날짜로 끊는다. 방을 만든 날과 추천이 나온 날이 다르면 서로 다른 날짜 행에 잡힌다.
- 서버 인스턴스가 하나라는 전제다. 시간표 캐시와 연결 풀 크기가 그 전제에 맞춰져 있다.
- 개발 서버(`next dev`)의 간헐적 404는 운영(`next build`)과 무관하지만 원인은 여전히 모른다.
