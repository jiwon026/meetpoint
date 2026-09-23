# backend-core 컨텍스트

Last Updated: 2026-09-23 (구현 완료, 브랜치 feat/backend-core, 21 commits)

## 이 태스크가 뭔가

우리지금만나 서비스의 FastAPI 백엔드 1단계. 설계 문서는 `docs/design.md`, 구현 계획은 같은 폴더의 `backend-core-plan.md`. 서브에이전트 방식으로 13개 태스크를 구현하고 태스크별 리뷰, 최종 브랜치 리뷰, 수정 1회를 거쳤다.

## 상태

- 테스트: `backend/` 에서 `.venv/Scripts/pytest -q` 90 passed. 경고 2건은 의존성(Starlette testclient, anyio) 것.
- 서버: `uvicorn app.main:app` 기동, `/health`, `POST /rooms` 확인.
- git: 로컬 저장소만 있음 (원격 없음, push 안 함). `main` 에는 문서 커밋 하나, 나머지는 `feat/backend-core`.
- 로컬 Python은 3.14, 배포용 `.python-version` 은 3.12.

## 핵심 파일

| 파일 | 역할 |
|---|---|
| `docs/design.md` | 확정된 설계. 8절 에러 표에 참여자 20명 상한 추가됨 |
| `backend/app/ranking/rank.py` | 공평함 순위 (최대 소요시간, 동점이면 합계) |
| `backend/app/rooms/service.py` | 방, 참여자, 결과 조립. 사용자 문구 상수 |
| `backend/app/rooms/router.py` | 엔드포인트 6개 |
| `backend/app/hubs.py` | 거점과 역 노드 매핑의 단일 구현 (지금은 이름 기준) |
| `backend/app/deps.py` | 공용 httpx.Client, 시간표 프로세스 캐시, 클라이언트 주입 |
| `backend/app/events/service.py` | 서울시 행사와 KOPIS. 원본 피드 캐시 + 거점별 캐시 + stale 폴백 |
| `backend/tests/conftest.py` | 시드 데이터 (역 6개, 거점 4개). 실제 데이터 전 유일한 검증 수단 |
| `backend/README.md` | 실행, 환경 변수, Railway 배포 절차 |

## 계획에서 벗어난 결정 (전부 원장 판단 기록에서 옮김)

1. 로컬 git 초기화만 함. 원격 없음. 되돌리려면 `.git` 삭제.
2. Python 3.14로 진행. 의존성 문제 없었음. 배포는 3.12 고정.
3. 서울시 API가 200 응답 안에 오류 코드를 주는 경우 `app/errors.py`의 `UpstreamError`로 올림. 최상위 INFO-200(데이터 없음)은 빈 목록.
4. 외부 클라이언트마다 httpx.Client를 만들지 않고 `deps.py`의 프로세스 공용 클라이언트를 주입. 종료 시 close는 아직 없음 (lifespan 미도입).
5. 시간표 행렬은 첫 요청 때 지연 로드, 비어 있으면 캐시하지 않고 경고 로그. 기동 시 사전 로드는 미도입 (test_health가 테이블 없이 앱을 만들기 때문).
6. 서울 행사 피드 갱신 실패 시 만료된 캐시를 조용히 사용하고 경고 로그만 남김. 맛집 등은 만료 캐시와 함께 `error` 문구를 같이 보냄. 탭 간 동작이 약간 다름.
7. KOPIS 공연장 좌표 조회는 요청 안에서 중복 제거만 함. 공연장 좌표 사전 적재는 transit-data 계획으로.
8. 방당 참여자 상한 20명 (스펙에 없던 것을 추가). 문구 "참여 인원이 가득 찼어요 (최대 20명)".
9. 거점과 역 노드를 이름으로 묶는 방식은 스펙 결함. 신촌(2호선)과 신촌(경의중앙선), 양평(5호선)과 양평(경의중앙선)처럼 이름이 같은 다른 역이 섞인다. 지금은 `app/hubs.py` 한 곳에 모아뒀고, transit-data 계획에서 그룹 키를 도입해 이 함수만 바꾼다.
10. `DATABASE_URL`의 `postgres://`, `postgresql://`는 `postgresql+psycopg://`로 자동 변환 (psycopg3만 설치됨).

## 남겨둔 사소한 항목 (머지 차단 아님)

- content_cache 같은 키 동시 쓰기 시 IntegrityError 가능성 (창이 매우 좁음)
- `/stations` LIKE 패턴에서 `%`, `_` 미이스케이프 (인젝션 아님)
- API 키가 비어 있어도 기동 시 경고 없음
- 결과 폴링마다 hubs와 stations를 다시 읽음 (정적 데이터, 캐시 가능)
- KOPIS 목록은 1페이지(100건)만 조회
- 첫 요청에서 시간표 로드 비용 (수 초 가능)

## 다음 계획에 넘길 것

**transit-data**
- 역 그룹 키 도입 (이름 매핑 대체), 적재 후 검증 (모든 거점이 노드에 매핑되는지, station_times에 거점 열이 있는지)
- KOPIS 공연시설 좌표 사전 적재 (venues 테이블)
- station_times 는 (from, to, minutes) Core insert. 백엔드는 거점 노드 열만 읽음
- 거점 100곳 큐레이션 시드 (tags, vibe_summary)

**frontend**
- `status == "ready"` 인데 추천이 비어 있는 상태 처리
- `/content` 응답에서 `error` 문구와 stale `items` 가 동시에 올 수 있음
- `via == "bus"` 인 leg는 "버스 15분" 표기
- 4종 콘텐츠는 탭 열 때 지연 로드, 행사 탭은 첫 로드가 느릴 수 있음
- 참여자 20명 상한 안내

## 의존성

- Python 3.12 이상, FastAPI, SQLAlchemy 2.0, pydantic-settings, httpx, psycopg[binary], pytest, respx
- 외부: 카카오 REST API 키, 서울 열린데이터광장 키, KOPIS 서비스키 (테스트에는 불필요)
