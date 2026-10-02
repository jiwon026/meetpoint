# frontend 체크리스트

세부 단계는 `frontend-plan.md` 참조. 설계는 `docs/frontend-design.md`.

## A. 백엔드

- [x] Task 1: 지역 선택과 지역 필터 (`Room.regions`, `?region=`, 순위 계산 전에 거르기)
- [x] Task 2: 거점 테마 데이터 (`hubs.csv`의 `themes` 열, 검증, 적재, 사용자 검토)
- [x] Task 3: 테마 우선 순위 규칙 (`rank_with_preference`, 5분)
- [x] Task 4: 결과 응답에 테마, 노선, 최단 기준 추가 (`Room.theme`, `lines`, `theme_match`, `best_max_minutes`)
- [x] Task 5: 주소 검색 프록시 (`POST /places/search`)
- [x] Task 6: 참가자 빼기와 다시 넣기 (`Participant.active`, PATCH)
- [x] Task 7: 백엔드 문서 갱신, DB 재생성, 실데이터 확인

## B. 프론트엔드

- [x] Task 8: 프론트 뼈대 (Next.js, 토큰, 테스트 도구, API 타입 생성)
- [x] Task 9: 순수 함수 모듈 (`lib/`)
- [x] Task 10: API 클라이언트와 훅
- [x] Task 11: 공통 UI 컴포넌트
- [x] Task 12: 화면 4.1 방 만들기
- [x] Task 13: 화면 4.2 참여
- [x] Task 14: 화면 4.3 거점 추천 (지도 제외)
- [x] Task 15: 카카오 지도
- [x] Task 16: 화면 4.4 거점 주변
- [x] Task 17: 흐름 테스트, 커버리지, 실행 문서

## 사용자 확인이 필요한 지점

- [ ] 테마별 거점 목록 검토 (Task 2) (초안으로 진행, 사용자 검토 대기)
- [ ] 방 만들기 화면 스크린샷 (Task 12) (2026-10-02 컨트롤러가 모바일 폭으로 동작 확인, 사용자 확인 대기)
- [ ] 참여 화면 스크린샷 (Task 13) (2026-10-02 컨트롤러가 모바일 폭으로 동작 확인, 사용자 확인 대기)
- [ ] 추천 화면 스크린샷 (Task 14) (2026-10-02 컨트롤러가 모바일 폭으로 동작 확인, 사용자 확인 대기)
- [ ] 카카오 JS 키와 도메인 등록 (Task 15, 없으면 지도 확인만 미룸)
  - 지도를 실제로 본 뒤 확인하고 고칠 것:
    - 핀이 하나면 경계가 퇴화해 최대 확대가 되고, 경계에 여백이 없다.
    - 키가 잘못됐거나 도메인이 등록되지 않으면 접히지 않고 회색 자리가 남을 수 있다.
    - 지도 레이어가 고정 하단 막대를 덮을 수 있다 (틀에 `isolate`를 더한다).
    - 행사 핀에는 번호가 있는데 행사 카드에는 번호가 없다.
- [ ] 주변 화면 스크린샷 (Task 16) (2026-10-02 컨트롤러가 모바일 폭으로 동작 확인, 사용자 확인 대기)

## 완료 기준

- [x] `backend/`에서 `.venv/Scripts/pytest -q` 254 passed
- [x] `frontend/`에서 `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` 통과
- [x] `npm run coverage`: `lib/`, `components/` 80% 이상 (줄 97.31%)
- [x] `npm run e2e` 1 passed
- [x] 실데이터 확인: 2호선 홍대입구, 수원, 잠실 방에서 지역 전체면 1위 판교(약 44분), 서울만이면 1위 가락시장(약 54분) (컨트롤러가 2026-10-02 브라우저에서 2호선 홍대입구, 1호선 수원, 2호선 잠실, 카페 테마로 확인: 첫 거점 판교 약 44분. 서울로 좁히면 서울 거점만 나오고 가락시장 약 54분이 가장 빠르지만, 5분 이내의 카페 테마 거점 세 곳이 먼저 와서 네 번째로 보인다)
- [x] 엠대시, 가운데 점 검사 통과 (Task 17 Step 7, `frontend/AGENTS.md`는 create-next-app 생성물이라 제외. 알려진 검출 1건: `CLAUDE.md`에서 금지 문자 두 개를 이름으로 말하는 규칙 문장 자체)
- [x] `docs/design.md`, `backend/README.md`, `frontend/README.md`, `CLAUDE.md`, `backend/data/SOURCES.md`가 구현과 일치 (2026-10-02 최종 리뷰 수정에서 `CLAUDE.md`, `docs/design.md`, `docs/frontend-design.md`의 어긋난 곳을 고침)
