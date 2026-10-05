# deploy 체크리스트

세부 단계는 `deploy-plan.md`, 설계는 `docs/deploy-design.md`.

## A. 올리기 전에 코드로 고칠 것

- [x] Task 1: 약속 날짜 서버 검증과 프론트 상한 (지난 날짜, 1년 넘는 날짜 거절. 한국 시간 기준)
- [x] Task 2: 로그에 주소, 검색어, 키를 남기지 않기
- [x] Task 3: 카카오가 JSON이 아닌 200을 줄 때 500이 나지 않게
- [x] Task 4: 규모 통계 (`daily_stats`: 만든 방, 등록한 참가자, 추천까지 간 방)
- [x] Task 5: 방 페이지를 검색에서 숨기고 제목 조회에 타임아웃
- [x] Task 6: 서버가 깨어나는 동안의 안내

## B. 배포 파일

- [x] Task 7: `render.yaml`, CI와 정리 워크플로, DB 연결 풀, RLS SQL, 문서. PR을 올려 CI가 실제로 통과하는지 확인

## C. 실제 배포 (사용자와 함께)

- [ ] Task 8 Step 1: PR 병합
- [ ] Task 8 Step 2: Supabase 프로젝트 (사용자)
- [ ] Task 8 Step 3: 표 만들기, RLS, 적재, Data API 끄기
- [ ] Task 8 Step 4: Render 서비스 (사용자)
- [ ] Task 8 Step 5: Vercel 프로젝트 (사용자)
- [ ] Task 8 Step 6: CORS와 카카오 도메인 연결
- [ ] Task 8 Step 7: 정리 작업 수동 실행, UptimeRobot (사용자)
- [ ] Task 8 Step 8: 운영 점검 8항목
- [ ] Task 8 Step 9: 기록과 마무리

## 완료 기준

- [x] `backend`에서 `.venv/Scripts/pytest -q` 전부 통과 (2026-10-05, 289 passed)
- [x] `frontend`에서 `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run e2e` 통과 (2026-10-05, 119 passed, e2e 1 passed)
- [ ] GitHub의 `ci` 워크플로 통과
- [ ] 운영 주소에서 방 만들기부터 주변 둘러보기까지 동작
- [ ] 운영 로그에 주소, 검색어, API 키가 없음
- [ ] `daily_stats`에 숫자가 쌓임
- [ ] 정리 작업이 예약대로 돌고, UptimeRobot이 서버를 깨워둠
- [ ] 문서(`docs/deploy-design.md`, `docs/design.md`, `backend/README.md`, `CLAUDE.md`)가 실제 구성과 일치
