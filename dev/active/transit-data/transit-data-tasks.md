# transit-data 체크리스트

세부 단계는 `transit-data-plan.md` 참조.

- [ ] Task 1: 백엔드 모델에 역 그룹 도입 (StationGroup, group_id, hubs.py)
- [ ] Task 2: 파이프라인 골격 (config, io, names)
- [ ] Task 3: 원본 파일 확보와 헤더 확인 (수동 다운로드 가능성 있음)
- [ ] Task 4: stations 단계
- [ ] Task 5: 시간 추정과 보정
- [ ] Task 6: edges 단계 (파서 3종)
- [ ] Task 7: groups 단계 (역 그룹, 환승 간선)
- [ ] Task 8: manual 역 순서 파일 (6개 노선)
- [ ] Task 9: times 단계 (다익스트라)
- [ ] Task 10: validate 단계
- [ ] Task 11: load 단계와 run_all
- [ ] Task 12: 거점 점수 (카카오)
- [ ] Task 13: 실제 데이터로 stations, edges, groups 실행
- [ ] Task 14: 거점 후보 점수와 hubs.csv 초안 (사용자 검토 지점)
- [ ] Task 15: times, validate, load 실행과 README

## 완료 기준

- `backend/` 에서 `.venv/Scripts/pytest -q` 전부 통과 (백엔드 기존 90개 포함)
- `python -m pipeline.run_all` 이 검증 통과로 끝남
- `python -m pipeline.load` 후 서버에서 홍대입구, 수원, 잠실 세 명의 방이 `ready`와 추천 5곳을 돌려줌
- `data/manual/hubs.csv` 100곳을 사용자가 검토함
