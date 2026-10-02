# frontend 컨텍스트

Last Updated: 2026-10-02 (계획 작성 완료, 구현 시작 전. 브랜치 `feat/frontend`)

## 이 태스크가 뭔가

화면 4개(방 만들기, 참여, 거점 추천, 거점 주변)짜리 Next.js 프론트를 새로 만들고, 그 화면이 쓰는 백엔드 보강을 함께 넣는다. 설계 `docs/frontend-design.md`, 계획 `frontend-plan.md`(17개 태스크: 백엔드 1~7, 프론트 8~17). 배포는 이번 범위가 아니다.

## 상태

- 설계 문서 커밋됨 (`docs/frontend-design.md`).
- 구현은 아직 시작하지 않았다. 시작 전 기준: `backend/`에서 pytest 214 passed, `frontend/` 폴더 없음.
- 로컬 `backend/dev.db`는 이전 스키마다. Task 7에서 지우고 다시 만든다 (그 전까지는 Task 1~6의 새 컬럼 때문에 서버가 기존 DB로는 뜨지 않을 수 있다. 테스트는 인메모리 DB라 영향 없다).

## 확정된 결정 (설계 문서 2절 요약)

| 항목 | 결정 |
|---|---|
| 화면 | 4단계 화면과 단계 표시줄. 하단 탭 없음 |
| 지역 | 방 만들 때 서울, 경기, 인천 복수 선택. 추천 화면 필터는 URL 쿼리(보는 사람만) |
| 테마 | 맛집, 카페, 술자리, 놀거리. 가장 빠른 곳보다 5분 이내로 느린 거점 중 테마에 맞는 곳을 앞에 |
| 주소 자동완성 | 백엔드 프록시 `POST /places/search` |
| 대리 입력 | 한 브라우저에서 여러 명 등록 허용 |
| 참가자 빼기 | 누구나 빼고 다시 넣기. 삭제가 아니라 `active` 끄기. 정원 20명은 전체 행 수 |
| 지도 | 카카오 지도 (추천에 거점 5곳 핀, 주변에 장소 핀) |
| 색 | 종이색 배경, 진녹색, 빨간 도장 포인트. 둥근 흰 카드 |
| 구조 | 브라우저가 FastAPI 직접 호출. 타입은 OpenAPI에서 생성 |

## 핵심 파일 (만들 것)

| 파일 | 역할 |
|---|---|
| `backend/app/options.py` | 지역과 테마의 허용 값. 백엔드와 파이프라인이 같이 쓴다 |
| `backend/app/ranking/rank.py` | `rank_with_preference`, `THEME_TOLERANCE_MINUTES = 5` |
| `backend/app/rooms/service.py` | 지역 필터(순위 계산 전), 테마, 활성 참가자만 계산 |
| `backend/pipeline/themes.py` | `hubs.csv`의 `themes` 열 초안 생성 (`THEME_TOP_N = 30`) |
| `frontend/lib/api/hooks.ts` | TanStack Query 훅 전부. 폴링 10초 |
| `frontend/lib/filter.ts` | URL 쿼리와 필터 사이 변환 |
| `frontend/lib/messages.ts` | 프론트 문구 원본 |
| `frontend/components/{join,result,hub}/*Screen.tsx` | 화면 로직. 페이지는 URL만 읽어 넘긴다 |
| `frontend/app/globals.css` | 색 토큰 |

## 계획을 쓰면서 정한 것 (설계 문서에 반영함)

1. 주소 검색은 GET이 아니라 `POST /places/search`다. 검색어가 집 주소일 수 있어 URL에 넣으면 서버 접근 로그에 남는다.
2. 주소 검색은 기존 `keyword_search`(중심 좌표 필수)를 못 써서 `KakaoLocalClient.suggest`를 새로 둔다. 카카오 `rect` 파라미터로 수도권 범위만 찾는다.
3. 화면 로직을 `*Screen.tsx`로 빼고 페이지를 얇게 둔다. 컴포넌트 테스트에 `next/navigation` 모킹이 필요 없어진다.
4. 추천 카드의 지역은 뱃지가 아니라 요약 줄 맨 앞에 쓴다 ("서울, 최대 약 22분, 차이 10분"). 접힌 카드에서도 지역이 보이고 흐름 테스트가 이 줄로 지역 필터를 검증한다.
5. 필터 칩은 URL에 값이 있으면 응답의 적용 값보다 URL을 기준으로 켜고 끈다. 응답이 오기 전에 연달아 눌러도 어긋나지 않게 하기 위해서다.
6. `rank_hubs`는 시그니처를 그대로 두고 내부에서 `rank_with_preference`를 부른다 (기존 테스트 유지).
7. 타입 생성은 백엔드를 띄우지 않고 `app.openapi()`를 직접 뽑는다 (`frontend/scripts/gen-api.mjs`).

## 사용자 작업이 필요한 곳

- Task 2 Step 10: 테마별 거점 목록 검토 (넣거나 뺄 곳).
- Task 15 Step 4: 카카오 JavaScript 키를 `frontend/.env.local`에 넣고, 카카오 개발자 콘솔에 `http://localhost:3000` 도메인 등록. 없어도 지도만 빠지고 진행 가능.
- 화면 태스크(12, 13, 14, 16)마다 스크린샷 확인.

## 구현할 때 조심할 것

- 지역 필터는 반드시 순위 계산 전에 건다. 뒤에 걸면 상위 5곳이 잘린 뒤라 결과가 비어 보인다. `tests/test_regions_api.py::test_region_filter_applies_before_top_five_cut`가 이걸 잡는다.
- Next.js 16, Tailwind 4, Vitest 최신판 기준으로 썼다. API가 다르면 설치된 버전 문서를 보고 맞추고 아래 "계획에서 벗어난 결정"에 적는다. MSW는 3이 아니라 2로 고정한다.
- 흐름 테스트(`npm run e2e`)는 3000번 개발 서버를 끄고 돌린다.
- Python 소스와 문서에 엠대시, 가운데 점 금지. Task 17 Step 7의 검사 명령으로 확인한다.
- `hubs.csv`를 스크립트로 다시 쓸 때 `themes` 열 말고 바뀐 것이 없는지 Task 2 Step 9의 비교 명령으로 확인한다.

## 계획에서 벗어난 결정

(구현하면서 채운다)

## 알려진 한계

- 역 id와 거점 id는 재적재하면 바뀔 수 있다. 추천 카드의 `legs` 누락 처리와 주변 화면의 되돌려보내기가 대비책이고 근본 해결(안정 id)은 범위 밖.
- 참가자 출발지는 고칠 수 없다. 빼고 새로 등록한다. 빠진 사람도 정원 20명에 들어간다.
- 빼기는 링크를 가진 누구나 할 수 있다. 되돌릴 수 있다는 것이 유일한 안전장치다.
- 지역과 테마 필터는 사람마다 다르게 볼 수 있다. 필터된 링크를 공유하면 같은 화면이 된다.
- 테마 판정(상위 30곳, 태그)과 허용 오차 5분은 고른 값이다.
- 장소 카드에 별점, 사진, 리뷰가 없다 (카카오 로컬 API가 주지 않는다).

## 다음 계획에 넘길 것 (배포)

- Vercel(프론트), Railway(백엔드), Supabase(DB). `NEXT_PUBLIC_API_BASE`, `CORS_ORIGINS`, 카카오 콘솔의 운영 도메인 등록이 한 묶음이다.
- Supabase에는 테이블을 새로 만들고 `pipeline.load`로 적재한다 (스키마에 `rooms.regions`, `rooms.theme`, `participants.active`, `hubs.themes` 포함).
- 서울 열린데이터광장, KOPIS 키가 아직 없다. 행사 탭은 키가 생기면 실제 데이터로 확인한다.
- 만료 방 정리(`scripts/cleanup_expired.py`)의 주기 실행.
- 2단계 후보: 카카오톡 공유 카드, 거점 투표, 참가자 본인 토큰(출발지 수정, 완전 삭제).
