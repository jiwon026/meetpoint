# backend-core 체크리스트

각 태스크의 세부 단계는 `backend-core-plan.md` 참조. 여기서는 태스크 단위로만 체크한다.

- [ ] Task 1: 프로젝트 골격과 헬스 체크
- [ ] Task 2: 지리 유틸리티
- [ ] Task 3: DB 모델과 테스트 시드
- [ ] Task 4: 가까운 역 찾기
- [ ] Task 5: 역간 시간표 조회와 참여자 소요시간
- [ ] Task 6: 공평함 순위
- [ ] Task 7: 카카오 지오코더와 역 검색
- [ ] Task 8: 콘텐츠 캐시
- [ ] Task 9: 맛집, 카페, 놀거리 (카카오 로컬)
- [ ] Task 10: 서울시 문화행사
- [ ] Task 11: 방 API (생성, 조회, 참여, 결과)
- [ ] Task 12: 거점 콘텐츠 엔드포인트와 KOPIS
- [ ] Task 13: 운영 스크립트와 README

## 완료 기준

- `backend/` 에서 `.venv/Scripts/pytest -q` 전부 통과
- `uvicorn app.main:app` 기동 후 `/health` 응답
- `/docs` 에서 방 생성, 참여, 결과, 콘텐츠 엔드포인트 확인
