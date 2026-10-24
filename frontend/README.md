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
| NEXT_PUBLIC_AMPLITUDE_API_KEY | Amplitude API 키. 익명 이용 통계를 보낸다. 비워두면 통계가 꺼진다 (로컬, 테스트, e2e는 비운다) |

통계 이벤트는 `lib/analytics.ts`에 타입으로 정해 둔 것만 보낸다. 닉네임, 역 이름, 주소, 검색어, 좌표, 방 링크(슬러그)는 어떤 이벤트에도 넣지 않는다. 방 주소에 슬러그가 들어 있어서 페이지 주소를 보내는 자동 수집도 모두 꺼 두었다.

지도를 쓰려면 카카오 개발자 콘솔의 앱 플랫폼 설정에서 Web 사이트 도메인에 `http://localhost:3000`을 등록한다.

## 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 단위 테스트 (Vitest). 키와 백엔드 없이 돈다 |
| `npm run coverage` | 커버리지. `lib/`, `components/` 80% 미만이면 실패 |
| `npm run e2e` | 흐름 테스트 (Playwright). 백엔드(8010)와 프론트(3100)를 직접 띄운다. 프론트는 빌드해서 띄우므로 1분 넘게 걸린다. 같은 `.next`를 쓰는 3000번 개발 서버는 끄고 실행 |
| `npm run gen:api` | 백엔드 스키마에서 `lib/api/schema.d.ts` 다시 생성. 백엔드 응답 모양을 바꿨을 때 |
| `npm run gen:og` | 링크 미리보기 그림(`app/opengraph-image.png`) 다시 찍기. `scripts/og-image.html`을 고친 뒤 |
| `npm run lint`, `npm run build` | 검사와 빌드 |

`npm run e2e`는 `frontend/.next`에 `NEXT_PUBLIC_API_BASE=http://localhost:8010`과 빈 카카오 키로 빌드한 결과를 남긴다. 그 뒤 다시 빌드하지 않고 `npm run start`를 하면 e2e 백엔드를 가리키고 지도가 없는 번들이 나간다. e2e 다음에는 `npm run build`를 다시 하고 `start`한다 (`npm run dev`는 영향 없음).
e2e 준비물: `backend/.venv` 설치 완료, 처음 한 번 `npx playwright install chromium`. CI(`.github/workflows/ci.yml`의 `e2e` 작업)도 push와 PR마다 같은 흐름 테스트를 돌린다.
흐름 테스트는 `next dev`가 아니라 빌드한 서버로 돈다. `next dev`에서는 흐름이 약 40% 확률로 Next의 404 화면에 닿았고 원인은 모른다 (자세한 내용은 `dev/active/frontend/frontend-context.md`의 알려진 한계).

## 화면 흐름

| 경로 | 화면 | 컴포넌트 |
|---|---|---|
| `/` | 출발지 넣기. 나와 친구들의 출발지를 한 화면에서 여러 개 넣고 "추천 보기"를 누르면 그때 방을 만들고 사람들을 차례로 등록한다 | `components/home/HomeScreen.tsx` |
| `/r/[slug]` | 참여. 링크를 받은 사람이 자기 출발지를 넣거나 사람을 더하고 뺀다 | `components/join/` |
| `/r/[slug]/result` | 추천 5곳과 사람별 이동 시간. 테마는 `?theme=` 쿼리 | `components/result/` |
| `/r/[slug]/hubs/[hubId]` | 동네 둘러보기. 맛집, 카페, 술자리, 놀거리, 행사 | `components/hub/` |
| `/privacy` | 개인정보 안내. 통계로 보내는 값이 바뀌면 같이 고친다 | `app/privacy/page.tsx` |

첫 화면의 "사용법 보기"를 누르면 온보딩(`components/ui/TourProvider.tsx`, 단계는 `tourSteps.ts`)이 예시 방(슬러그 `demo`)의 추천과 둘러보기 화면을 실제로 오가며 보여준다. 저절로 띄우지 않는다. 예시 방은 서버를 부르지 않고 `lib/api/client.ts`가 `lib/demo-data.json`으로 답하며 읽기만 된다. 온보딩에 새 단계를 더하려면 그 요소에 `data-tour`를 단다.

## 구조

- `app/`: 경로. URL을 읽어 화면 컴포넌트에 넘기는 얇은 껍데기
- `components/{home,join,result,hub}/*Screen.tsx`: 화면 로직. 라우터에 의존하지 않아 그대로 테스트한다
- `components/ui/`: 버튼, 칩, 날짜 고르기 같은 공용 조각과 온보딩
- `lib/demo.ts`, `lib/demo-data.json`: 온보딩에 쓰는 예시 방 응답
- `lib/analytics.ts`: 익명 통계 이벤트와 속성 타입
- `lib/api/`: fetch 래퍼, TanStack Query 훅, 생성된 타입
- `lib/messages.ts`: 프론트 문구. 백엔드가 주는 문구(`detail`)는 그대로 보여준다
- `app/globals.css`: 색 토큰. 컴포넌트에 색 값을 직접 쓰지 않는다
