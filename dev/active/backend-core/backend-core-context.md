# backend-core 컨텍스트

Last Updated: 2026-09-23

## 이 태스크가 뭔가

우리지금만나 서비스의 FastAPI 백엔드 1단계. 설계 문서는 `docs/design.md`, 구현 계획은 같은 폴더의 `backend-core-plan.md`.

## 핵심 파일

| 파일 | 역할 |
|---|---|
| `docs/design.md` | 확정된 설계. 결정 사항과 이유가 2절 표에 있음 |
| `dev/active/backend-core/backend-core-plan.md` | 13개 태스크, TDD 단계별 코드 포함 |
| `backend/app/ranking/rank.py` | 서비스의 심장. 공평함 순위 |
| `backend/app/rooms/service.py` | 방, 참여자, 결과 조립 |
| `backend/tests/conftest.py` | 시드 데이터 (역 6개, 거점 4개). 실제 데이터 전 유일한 검증 수단 |

## 확정된 의사결정 (설계 문서 요약)

- 추천 기준은 공평함: 참여자 중 최대 소요시간 최소화, 동점이면 합계
- 후보지는 큐레이션한 만남 거점만. 역 전체가 아님
- 이동시간은 사전 계산된 station_times 테이블 조회. 외부 경로 API 없음
- 로그인 없음, 방 링크 공유, 원문 주소 저장 안 함 (좌표 소수점 3자리)
- 비용 0원: 카카오 로컬, 서울시 문화행사, KOPIS 무료 API만
- git은 아직 안 씀. 사용자가 나중에 올릴 수 있으니 커밋 단계는 계획에서 뺐음

## 계획 작성 중 내린 세부 결정

- `stations`와 `hubs`를 분리. 출발지 근처 역은 전체 역에서, 후보는 거점에서만 찾음
- 환승역은 노선별로 노드가 따로 있음. 거점 소요시간은 같은 이름의 모든 노드 중 최소값
- 역간 시간표는 프로세스당 한 번 메모리에 올림 (deps.get_matrix). 거점 노드로 가는 행만 로드
- 서울시 행사는 전체 피드를 한 번 캐시하고 거점별로 로컬 필터. LAT/LOT 뒤바뀐 행 보정
- KOPIS는 공연장 좌표를 별도 호출로 얻어야 해서 30일 캐시
- 외부 API 실패 시 200으로 응답하되 `error` 필드에 문구, items는 만료 캐시 또는 빈 목록
- 마이그레이션 도구 없이 create_all (MVP)

## 의존성

- Python 3.12, FastAPI, SQLAlchemy 2.0, pydantic-settings, httpx, pytest, respx
- 외부: 카카오 REST API 키, 서울 열린데이터광장 키, KOPIS 서비스키 (테스트에는 불필요)

## 다음 계획

1. `dev/active/transit-data/`: 공공데이터로 stations, station_times, hubs 채우기
2. `dev/active/frontend/`: Next.js 화면 3개
