# backend-core 체크리스트

각 태스크의 세부 단계는 `backend-core-plan.md` 참조. 여기서는 태스크 단위로만 체크한다.

- [x] Task 1: 프로젝트 골격과 헬스 체크
- [x] Task 2: 지리 유틸리티
- [x] Task 3: DB 모델과 테스트 시드
- [x] Task 4: 가까운 역 찾기
- [x] Task 5: 역간 시간표 조회와 참여자 소요시간
- [x] Task 6: 공평함 순위
- [x] Task 7: 카카오 지오코더와 역 검색
- [x] Task 8: 콘텐츠 캐시
- [x] Task 9: 맛집, 카페, 놀거리 (카카오 로컬)
- [x] Task 10: 서울시 문화행사 (수정 1회: in-band 오류 코드를 UpstreamError로)
- [x] Task 11: 방 API (생성, 조회, 참여, 결과)
- [x] Task 12: 거점 콘텐츠 엔드포인트와 KOPIS
- [x] Task 13: 운영 스크립트와 README
- [x] 최종 브랜치 리뷰와 수정 (치명 1, 중요 7, 사소 6 반영)

## 완료 기준 (2026-09-23 확인)

- [x] `backend/` 에서 `.venv/Scripts/pytest -q` 전부 통과 (90 passed, 의존성 경고 2건)
- [x] `uvicorn app.main:app` 기동 후 `/health` 응답 `{"ok":true}`
- [x] `POST /rooms` 가 slug와 만료일을 돌려줌

## 남은 일 (이 계획 밖)

- 브랜치 `feat/backend-core` 를 `main` 에 합칠지 결정 (원격 없음, 로컬 저장소만)
- 다음 계획: `dev/active/transit-data/` (역 데이터, 시간표, 거점 시드), `dev/active/frontend/`
