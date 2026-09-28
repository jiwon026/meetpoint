# transit-data 체크리스트

세부 단계는 `transit-data-plan.md` 참조.

- [x] Task 1: 백엔드 모델에 역 그룹 도입 (StationGroup, group_id, hubs.py)
- [x] Task 2: 파이프라인 골격 (config, io, names) (수정 1회: 열 개수 안 맞는 CSV 행은 실패)
- [x] Task 3: 원본 파일 확보와 헤더 확인 (국가철도공단 13개 파일 에이전트가 직접 확보)
- [x] Task 4: stations 단계 (수정 1회: 중복 역은 500m 이내일 때만 건너뜀)
- [x] Task 5: 시간 추정과 보정 (상수 두 차례 재보정, 최종 43.4/61/110)
- [x] Task 6: edges 단계 (파서 3종)
- [x] Task 7: groups 단계 (역 그룹, 환승 간선)
- [x] Task 8: manual 역 순서 파일 (6개 노선)
- [x] Task 9: times 단계 (다익스트라)
- [x] Task 10: validate 단계
- [x] Task 11: load 단계와 run_all
- [x] Task 12: 거점 점수 (카카오)
- [x] Task 13: 실제 데이터로 stations, edges, groups 실행 (원본 결함 보정 규칙 다수, 수정 1회)
- [x] Task 14: 거점 후보 점수와 hubs.csv 초안 (사용자 검토: 변경 없음)
- [x] Task 15: times, validate, load 실행과 README
- [x] 최종 브랜치 리뷰와 수정 (중요 4건, 사소 6건 반영)

## 완료 기준 (2026-09-28 확인)

- [x] `backend/` 에서 `.venv/Scripts/pytest -q` 214 passed (의존성 경고 2건)
- [x] `python -m pipeline.run_all` 검증 통과 (상식 검증 5건: 홍대입구-강남 34, 잠실-강남 12, 수원-강남 55, 부평-서울 53, 판교-강남 16)
- [x] `python -m pipeline.load` 후 서버에서 홍대입구, 수원, 잠실 세 명의 방이 `ready`와 추천 5곳 (1위 판교 43/44/38)
- [x] `data/manual/hubs.csv` 100곳 사용자 검토 완료

## 남은 일 (이 계획 밖)

- 브랜치 `feat/transit-data`를 `main`에 합칠지 결정
- Supabase 첫 적재 (README 배포 절 순서대로)
- 다음 계획: `dev/active/frontend/`
