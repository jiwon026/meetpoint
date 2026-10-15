# 첫 화면 고치기: 방 만들기와 참여를 한 화면으로

## Context

홍보로 들어온 42명 중 28명이 방을 만들지 않고 나갔고, 방을 만든 14명 중 6명은 출발지를 하나도 넣지 않았다. 지금 첫 화면은 결과를 보여 주기 전에 모임 이름, 날짜, 지역, 모임 종류부터 묻는다. 실제로는 한 사람이 친구 몫까지 출발역을 넣어 보는 쓰임이 많은데(출발지 등록 28건을 11명이 함) 화면은 링크를 돌려야 시작되는 것처럼 생겼다. 사용자가 받은 피드백 일곱 가지도 같은 곳을 가리킨다.

정한 것 (2026-10-14 사용자 결정):
- 지역 고르는 칸을 없애고 방은 서울로 만든다
- 1번(방 만들기)과 2번(참여) 화면을 합친다. 여기까지 끝낸 뒤에 지인과 에브리타임에 뿌린다
- 현재 위치로 출발지 넣기는 이번에 하지 않는다

목표: 첫 화면에서 출발역 두 개를 넣고 버튼 한 번으로 추천을 본다.

## 바뀌는 흐름

지금: `/`(이름, 날짜, 지역, 종류) → `/r/slug`(닉네임과 출발지를 한 명씩 등록) → 추천 → 둘러보기

바꾼 뒤: `/`(출발역을 여러 개 넣는다, 날짜와 이름은 기본값) → "추천 보기"를 누르면 방을 만들고 참가자를 차례로 등록한 뒤 추천으로 간다 → 둘러보기

- 방은 "추천 보기"를 누를 때 만든다. 그 전의 입력은 화면 안에만 있다(구경만 하고 나간 사람이 빈 방을 남기지 않는다)
- 초대받은 사람은 지금처럼 `/r/slug`에서 자기 출발지 하나를 넣는다. 이 화면은 남긴다
- 추천 화면에서 뒤로 가면 `/r/slug?add=1`(사람 더 넣기)로 간다. 지금 `app/r/[slug]/page.tsx`의 `replaceState` 방식을 그대로 쓴다

## 작업 순서

### 0. 준비
- 브랜치 `feat/first-screen`
- `dev/active/first-screen/`에 계획, 컨텍스트, 체크리스트 세 파일
- `frontend/node_modules/next/dist/docs/`에서 필요한 부분 읽기 (`frontend/AGENTS.md`)

### 1. 화면 시안 먼저 (코드 전에)
합친 첫 화면을 두세 가지로 그려 나란히 보여 주고 사용자가 고른다. 갈리는 지점은 출발지 입력 줄의 모양(줄마다 검색 칸 vs 검색 칸 하나에 고른 역이 아래에 쌓임), 날짜와 이름을 어디에 둘지, 진행 바의 모양이다. 색은 `app/globals.css` 토큰만 쓴다.

### 2. 백엔드: 환승역을 한 줄로 (TDD)
- `backend/app/stations.py` `search_stations`: 이름으로 찾되 `(group_id, name)`으로 묶은 뒤에 10개로 자른다. 이름만으로 묶지 않는다(신촌과 양평은 그룹이 둘, 총신대입구와 이수는 한 그룹에 이름이 둘)
- `backend/app/schemas.py` `StationOut`: `{id, name, lines: list[str]}`로 바꾼다. `id`는 그 묶음의 가장 작은 노드 id
- `backend/app/rooms/service.py` `add_participant`: `station_id`로 고르면 같은 `group_id`의 모든 노드를 도보 0분으로 `nearest_stations` 앞에 넣고, 지금처럼 걸어갈 수 있는 이웃 역을 뒤에 붙인다. 어느 노선을 타든 빠른 쪽으로 계산된다. `transit/travel.py`는 그대로다
- 테스트: `tests/conftest.py`의 `seeded`에 노드가 둘인 그룹을 더한 픽스처(`tests/test_hubs.py`의 방식), `tests/test_stations.py`, `tests/test_rooms_api.py::test_station_search_endpoint` 고치기, 환승역을 고른 참가자의 `nearest_stations` 확인
- DB 구조는 안 바뀐다. 마이그레이션 없음

### 3. 프론트: 부품
- `npm run gen:api`로 타입 다시 만들기
- `components/join/OriginSearch.tsx`: 역 한 줄에 노선 배지 여러 개(`LineBadge` 재사용), 고른 뒤 라벨은 `강남 (2호선, 신분당선)`
- `components/ui/DateStepper.tsx` (새로): 하루 앞뒤 버튼, 요일 표시(`lib/format.ts`의 `formatMeetDate`), 오늘보다 앞이나 365일 뒤로는 못 감. 기본값은 오늘에서 7일 뒤(`addDaysIso`). 달력으로 직접 고르는 길도 남긴다
- `components/ui/ProgressBar.tsx` (새로): `StepIndicator`를 대신한다. 세 단계(출발지, 추천, 둘러보기)와 채워진 정도를 보여 준다. 첫 화면에서는 출발지를 넣을 때마다 조금씩 찬다. 지난 단계로 돌아가는 링크는 지금처럼 둔다
- `lib/api/hooks.ts`: 방을 만든 직후 그 방에 등록할 수 있게 참가자 등록을 slug를 인자로 받는 형태로도 쓸 수 있게 한다

### 4. 프론트: 합친 첫 화면
- `components/home/HomeScreen.tsx` (새로, 화면 로직은 `*Screen.tsx`에 두는 규약). `app/page.tsx`는 이것만 그린다
  - 출발지 목록: 처음에 두 칸, "한 명 더" 버튼으로 20명까지. 이름은 안 적어도 되고 비우면 `나`, `친구 1`, `친구 2`로 채운다
  - 약속 날짜(`DateStepper`)와 모임 이름(비우면 `10월 21일 (수) 모임`)은 접어 둔 "약속 정보" 안에 둔다. 모임 종류는 여기서 묻지 않고 추천 화면의 필터에서 고른다
  - 버튼 "추천 보기"는 출발지가 둘 이상일 때 켜지고 화면 아래에 붙는다(`StickyAction`)
  - 누르면: `POST /rooms`(`regions: ["서울"]`, 기본 이름과 날짜) → 참가자를 한 명씩 차례로 `POST` → `addMine(slug, id)` → `replaceState`로 `/r/slug?add=1` → 추천 화면으로
  - 중간에 실패하면(주소를 못 찾음, 수도권 밖, 요청 제한): 방은 이미 있으니 `/r/slug?add=1`로 보내고 실패한 사람과 이유를 알린다. 이미 등록된 사람은 그대로 보인다. 다시 눌러 방이 두 개 생기지 않게 버튼을 잠근다
  - 개인정보 안내(`MSG_PRIVACY`)와 "이렇게 써요"는 문구를 새 흐름에 맞춰 남긴다
- 지우는 것: `components/room/CreateRoomForm.tsx`와 테스트, `MSG_TITLE_REQUIRED`, `MSG_REGION_REQUIRED`. `RegionChips`는 추천 화면 필터가 쓰니 남긴다. `ThemePicker`는 쓰는 곳이 없어지면 지운다
- `components/join/JoinScreen.tsx`, `RoomSummary.tsx`: 초대받은 사람용으로 남기고 진행 바와 문구만 맞춘다
- `components/result/ResultScreen.tsx`: 서울로 만든 방이라 지역 필터의 기본이 서울이다. 경기와 인천은 필터에서 켤 수 있다(지금 동작 그대로)

### 5. 통계와 문구
- `lib/analytics.ts`: `room_created`와 `participant_added`를 새 화면에서 보낸다(속성 모양은 그대로, `regions`는 늘 `서울`). 첫 화면에서 출발지를 처음 넣었을 때를 알 수 있게 `origin_drafted { count }` 하나를 더한다. 닉네임, 역, 주소, 검색어는 넣지 않는다
- `components/analyticsPrivacy.test.tsx`를 새 화면까지 넓힌다
- `app/privacy/page.tsx`: "고른 지역" 문구를 고친다
- `lib/messages.ts`와 `docs/design.md` 8절을 같이 고친다

### 6. 테스트와 문서
- 단위: `HomeScreen.test.tsx`(기본값, 둘 미만이면 버튼 꺼짐, 요청 순서와 본문, 중간 실패, 두 번 누르기 방지, 통계), `DateStepper.test.tsx`, `ProgressBar.test.tsx`, `OriginSearch`와 `JoinForm` 테스트의 역 응답 모양
- `frontend/e2e/flow.spec.ts`: 앞부분을 새 흐름으로 다시 쓴다(첫 화면에서 홍대입구와 수원을 넣고 추천 보기, 뒤로 가면 `?add=1`). 처음에 서울 거점만 나오고 필터에서 경기를 켜면 다른 지역이 나오는지로 바꾼다
- 문서: `docs/design.md`(31, 37, 85, 86, 153, 156행 언저리), `docs/frontend-design.md`, 루트 `CLAUDE.md`의 흐름 설명

### 7. 검증과 배포
- `backend`: `.venv/Scripts/pytest -q`
- `frontend`: `npm test`, `npm run build`, `npm run e2e`
- 로컬에서 직접 눌러 보기: 백엔드 8000과 `npm run dev`를 띄우고 휴대폰 크기로 (1) 출발역 둘을 넣고 추천까지 (2) 환승역이 한 줄로 뜨는지 (3) 주소 하나를 일부러 틀리게 넣어 중간 실패 (4) 초대 링크로 들어와 한 명 더 넣기 (5) 뒤로 가기. 화면을 찍어 보여 준다
- `code-reviewer`로 한 번 검토
- 사용자가 승인하면 커밋하고 PR을 연다. `main`에 합쳐지면 자동 배포된다. 백엔드와 프론트가 같은 PR이라 배포 순서가 어긋나는 몇 분 동안 역 검색 응답 모양이 안 맞을 수 있다. 프론트가 `lines`가 없으면 `line`으로 읽게 해서 그 사이를 넘긴다(백엔드는 한동안 `line`도 같이 준다)
- 배포 뒤 운영 사이트에서 한 번 더 확인하고, 그다음에 카카오톡과 에브리타임에 뿌린다

## 이번에 하지 않는 것
- 현재 위치로 출발지 넣기
- 여러 명을 한 번에 등록하는 새 API (차례로 보내면 충분하고 요청 제한에도 안 걸린다)
- 방 이름을 서버에서 지어 주기 (프론트가 기본 이름을 보내면 DB와 API를 안 바꿔도 된다)

## 알고 가는 한계
- 방을 만든 뒤 참가자 등록이 실패하면 방은 남는다. 지울 방법이 없어 `rooms_created` 통계에 잡힌다
- Render가 잠들어 있으면 첫 요청이 길게 걸린다. 버튼을 잠그고 기다리는 안내(`SlowNote`)를 보여 준다
- 서울로 고정하면 수원이나 인천에서 오는 사람이 낀 모임도 처음에는 서울 거점만 본다. 필터에서 넓힐 수 있다

## 고치는 주요 파일
- 백엔드: `app/stations.py`, `app/schemas.py`, `app/rooms/service.py`, `app/rooms/router.py`, `tests/`
- 프론트: `app/page.tsx`, `app/r/[slug]/**/page.tsx`(진행 바), `components/home/HomeScreen.tsx`, `components/join/OriginSearch.tsx`, `components/ui/DateStepper.tsx`, `components/ui/ProgressBar.tsx`, `lib/api/hooks.ts`, `lib/analytics.ts`, `lib/messages.ts`, `app/privacy/page.tsx`, `e2e/flow.spec.ts`
- 문서: `docs/design.md`, `docs/frontend-design.md`, `CLAUDE.md`, `dev/active/first-screen/`
