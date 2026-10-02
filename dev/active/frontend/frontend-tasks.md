# frontend 체크리스트

세부 단계는 `frontend-plan.md` 참조. 설계는 `docs/frontend-design.md`.

## A. 백엔드

- [ ] Task 1: 지역 선택과 지역 필터 (`Room.regions`, `?region=`, 순위 계산 전에 거르기)
- [ ] Task 2: 거점 테마 데이터 (`hubs.csv`의 `themes` 열, 검증, 적재, 사용자 검토)
- [ ] Task 3: 테마 우선 순위 규칙 (`rank_with_preference`, 5분)
- [ ] Task 4: 결과 응답에 테마, 노선, 최단 기준 추가 (`Room.theme`, `lines`, `theme_match`, `best_max_minutes`)
- [ ] Task 5: 주소 검색 프록시 (`POST /places/search`)
- [ ] Task 6: 참가자 빼기와 다시 넣기 (`Participant.active`, PATCH)
- [ ] Task 7: 백엔드 문서 갱신, DB 재생성, 실데이터 확인

## B. 프론트엔드

- [ ] Task 8: 프론트 뼈대 (Next.js, 토큰, 테스트 도구, API 타입 생성)
- [ ] Task 9: 순수 함수 모듈 (`lib/`)
- [ ] Task 10: API 클라이언트와 훅
- [ ] Task 11: 공통 UI 컴포넌트
- [ ] Task 12: 화면 4.1 방 만들기
- [ ] Task 13: 화면 4.2 참여
- [ ] Task 14: 화면 4.3 거점 추천 (지도 제외)
- [ ] Task 15: 카카오 지도
- [ ] Task 16: 화면 4.4 거점 주변
- [ ] Task 17: 흐름 테스트, 커버리지, 실행 문서

## 사용자 확인이 필요한 지점

- [ ] 테마별 거점 목록 검토 (Task 2)
- [ ] 방 만들기 화면 스크린샷 (Task 12)
- [ ] 참여 화면 스크린샷 (Task 13)
- [ ] 추천 화면 스크린샷 (Task 14)
- [ ] 카카오 JS 키와 도메인 등록 (Task 15, 없으면 지도 확인만 미룸)
- [ ] 주변 화면 스크린샷 (Task 16)

## 완료 기준

- [ ] `backend/`에서 `.venv/Scripts/pytest -q` 254 passed
- [ ] `frontend/`에서 `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` 통과
- [ ] `npm run coverage`: `lib/`, `components/` 80% 이상
- [ ] `npm run e2e` 1 passed
- [ ] 실데이터 확인: 홍대입구, 수원, 잠실 방에서 지역 전체면 1위 판교(약 45분), 서울만이면 1위 가락시장(약 55분)
- [ ] 엠대시, 가운데 점 검사 통과 (Task 17 Step 7)
- [ ] `docs/design.md`, `backend/README.md`, `frontend/README.md`, `CLAUDE.md`, `backend/data/SOURCES.md`가 구현과 일치
