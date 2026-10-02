# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

우리지금만나 (GitHub: jiwon026/meetpoint). 친구들이 각자 출발지를 입력하면 "가장 오래 걸리는 사람의 이동시간"이 가장 짧은 만남 거점을 추천하고, 그 동네의 맛집, 카페, 놀거리, 행사를 보여주는 웹 서비스. 수도권 지하철 기준.

문서를 먼저 읽을 것:
- `docs/design.md`: 제품 설계와 확정 결정 (추천 규칙, 프라이버시, 에러 문구 8절)
- `docs/transit-data-design.md`: 데이터 파이프라인 설계
- `dev/active/<task>/`: 진행 중이거나 끝난 태스크의 계획, 컨텍스트(결정과 한계), 체크리스트. 새 작업 전에 `*-context.md`의 "다음 계획에 넘길 것"을 읽는다.
- `backend/data/SOURCES.md`: 원본 데이터 출처, 확인된 사실, 모든 상수 변경의 근거

## 명령 (전부 `backend/` 안에서 실행)

```bash
cd backend
.venv/Scripts/pip install -e ".[dev]"          # 처음 한 번 (Windows venv 경로)
.venv/Scripts/pytest -q                        # 전체 테스트
.venv/Scripts/pytest tests/test_rooms_api.py -v            # 파일 하나
.venv/Scripts/pytest tests/pipeline/test_edges.py::test_build_edges_measured_and_estimated -v   # 테스트 하나
.venv/Scripts/uvicorn app.main:app --reload    # 서버, 문서는 http://localhost:8000/docs
```

한글을 출력하는 스크립트는 `PYTHONIOENCODING=utf-8`을 앞에 붙인다 (Git Bash에서 깨짐).

데이터 파이프라인:

```bash
.venv/Scripts/python -m pipeline.run_all       # stations, edges, groups, times, validate (검증 통과해야 끝)
.venv/Scripts/python -m scripts.init_db        # 테이블 생성 (스키마 바뀌면 dev.db 지우고 다시)
.venv/Scripts/python -m pipeline.load          # data/out CSV를 .env의 DATABASE_URL에 적재
.venv/Scripts/python -m pipeline.hubs          # 거점 후보 점수 (카카오 키 필요, 약 4,500회 호출)
```

`data/manual/hubs.csv`만 고쳤으면 `pipeline.times`, `pipeline.validate`, `pipeline.load` 세 개만. 적재 후 서버 재시작 (시간표를 프로세스 메모리에 캐시).

`.env`는 `.env.example`을 복사해 만든다. 테스트는 키 없이 돈다 (외부 API는 전부 respx로 모킹).

## 아키텍처

### 백엔드 (`backend/app/`)

FastAPI + SQLAlchemy 2.0. 라우터는 얇고 로직은 서비스에 있다. 외부 HTTP 호출은 클라이언트 클래스 안에서만 하고(`geocoding/kakao.py`, `places/kakao_local.py`, `events/seoul.py`, `events/kopis.py`) 서비스와 라우터는 `deps.py`에서 주입받는다. `deps.py`는 프로세스 공용 `httpx.Client` 하나와 역간 시간표 캐시(`get_matrix`)를 들고 있다.

요청 흐름: `rooms/router.py` -> `rooms/service.py` -> (`geocoding/nearest.py`로 가까운 역 최대 3개) -> `ranking/rank.py`의 `rank_hubs` -> `transit/travel.py`의 `travel_minutes`(출발 후보 x 거점 노드 최소값) -> `transit/matrix.py`(DB `station_times` 조회).

핵심 데이터 개념:
- `Station`은 노선별 노드(환승역은 노선 수만큼). `StationGroup`은 물리적으로 같은 역. `Hub`는 거점이고 `group_id`로 노드들과 이어진다 (`app/hubs.py`). 이름으로 묶지 않는다: 신촌(2호선)과 신촌(경의중앙선)은 다른 그룹.
- `station_times`는 모든 노드에서 거점 노드까지의 분만 들어 있다. 없는 쌍은 `None`이고 그 거점은 순위에서 빠진다.
- 참가자는 원문 주소를 저장하지 않는다. 좌표는 소수점 3자리, `nearest_stations`는 역 id 목록(JSON). 역 id는 원본 데이터 갱신 시 바뀔 수 있다(알려진 한계).
- 콘텐츠는 `cache.py`의 `content_cache` 테이블에 24시간 캐시. 실패 시 만료 캐시라도 돌려주고 `error` 문구를 붙인다.
- 방은 `regions`(서울, 경기, 인천 중 1개 이상)와 `theme`(없을 수 있음)을 가진다. 결과 API의 `region`, `theme` 쿼리가 방 기본값보다 우선한다. 지역 필터는 반드시 `rank_with_preference` 전에 건다.
- 참가자는 지우지 않고 `active`를 끈다. 계산은 `active`만, 정원 20명은 전체 행 수.

사용자에게 보이는 에러 문구는 `rooms/service.py`의 `MSG_*` 상수와 `docs/design.md` 8절이 원본이다. 바꾸면 둘 다.

### 파이프라인 (`backend/pipeline/`)

공공데이터 -> `data/out/*.csv` -> DB. 단계별 모듈(`stations`, `edges`, `groups`, `times`, `validate`, `load`)은 각각 순수 함수 + 얇은 `main()`. 원본은 `data/raw/`(커밋됨, 수정 금지), 수동 데이터는 `data/manual/`.

`pipeline/config.py`가 가장 중요한 파일이다. 상수뿐 아니라 원본 결함을 보정하는 표가 전부 여기 있고(`SEGMENT_PATCHES`, `KRAIL_KM_DIRECTION`, `KRAIL_EXCLUDE`, `EXPECTED_KM_DROPS`, `EDGE_LENGTH_ALLOWLIST`, `STD_LINE_OVERRIDES`, `STD_COORD_OVERRIDES`), 파일 상단 주석에 노선이 개통되거나 원본이 갱신될 때의 절차가 있다. 표에 없는 새 이상은 조용히 넘기지 않고 파이프라인이 실패하도록 설계되어 있다. 이 원칙을 깨지 말 것: 매칭 실패, 이상치, 검증 실패는 데이터를 지우는 게 아니라 매핑을 고쳐서 해결한다.

시간 모델: 1~8호선은 서울교통공사 실측(정차 제외 운행시간이라 간선마다 정차 0.5분을 더함), 나머지는 거리 / 속도(urban 43.4, regional 61, gtx 110 km/h) + 0.5분. 환승은 실측 도보 + 대기 2.5분, 없으면 4분. 상수를 바꾸면 `SOURCES.md`에 근거를 적고 `validate.py`의 상식 검증 5건(홍대입구-강남 30~45 등)이 통과해야 한다. 검증 범위는 넓히지 않는다.

## 규약

- 테스트는 실동작 검증. 외부 API는 respx, DB는 SQLite 인메모리(`tests/conftest.py`의 `seeded` 픽스처: 역 6개, 거점 4개). 파이프라인은 픽스처 CSV/XLSX와 합성 소형 데이터(`tests/pipeline/test_run_all_synthetic.py`).
- SQLite에서 도는 코드가 Postgres(Supabase)에서도 돌아야 한다. 삭제 순서와 외래키(`content_cache.hub_id -> hubs`)에 주의. `DATABASE_URL`의 `postgresql://`은 `app/db.py`가 `postgresql+psycopg://`로 바꾼다.
- 마이그레이션 도구 없음. 스키마가 바뀌면 테이블을 지우고 `init_db`부터.
- 문서와 코드 문구에 엠대시(—)와 가운데 점(·)을 쓰지 않는다. 데이터의 `raw_name` 컬럼만 예외.
- Python 소스에 `　` 같은 이스케이프는 문자 그대로 남겨야 한다. 파일 쓰기 도구가 실제 보이지 않는 문자로 바꿔 넣는 경우가 있었으니 확인할 것.
- 큰 작업은 `dev/active/<task>/`에 계획, 컨텍스트, 체크리스트 세 파일을 만들고 시작한다. 끝나면 컨텍스트에 결정과 한계를 남긴다.
