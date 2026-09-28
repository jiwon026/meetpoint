# 우리지금만나 백엔드

아래 명령은 전부 이 폴더(`backend/`) 안에서 실행한다. 저장소 루트에서는 `cd backend` 먼저.

## 로컬 실행

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"
cp .env.example .env
.venv/Scripts/python -m scripts.init_db
.venv/Scripts/uvicorn app.main:app --reload
```

`.env`에 키를 채운 뒤 실행한다. API 문서: http://localhost:8000/docs

## 테스트

```bash
.venv/Scripts/pytest -q
```

## 환경 변수

| 이름 | 설명 |
|---|---|
| DATABASE_URL | Postgres 연결 문자열. 로컬 기본값은 sqlite:///./dev.db. Supabase가 주는 `postgresql://...` 그대로 넣으면 된다. 내부에서 `postgresql+psycopg://`로 바꾼다. 풀러(6543)보다 세션 모드(5432)를 권장 |
| KAKAO_REST_KEY | 카카오 개발자 콘솔의 REST API 키 (지오코딩, 로컬 검색) |
| SEOUL_API_KEY | 서울 열린데이터광장 인증키 (문화행사) |
| KOPIS_API_KEY | 공연예술통합전산망 서비스키 |
| CORS_ORIGINS | 프론트 주소. 쉼표로 여러 개 |

## 데이터 적재

역, 역간 시간표, 거점은 `pipeline/`이 만든 `data/out/*.csv`에서 적재한다. 원본은 `data/raw/`, 출처는 `data/SOURCES.md`.

```bash
.venv/Scripts/python -m scripts.init_db     # 처음 한 번
.venv/Scripts/python -m pipeline.load       # .env의 DATABASE_URL에 적재
```

이 버전은 `stations`와 `hubs`에 `group_id` 컬럼과 `station_groups` 테이블을 추가했다. `scripts.init_db`는 기존 테이블에 컬럼을 추가하지 않으므로, 이전 버전으로 만든 DB(로컬 `dev.db` 포함)는 `station_groups`, `stations`, `hubs`, `station_times`, `content_cache` 테이블을 지우고 `init_db`를 다시 실행한 뒤 적재한다. 로컬은 `dev.db` 파일을 지우면 된다.

원본을 갱신했으면 다시 계산한다.

```bash
.venv/Scripts/python -m pipeline.run_all    # stations, edges, groups, times, validate
.venv/Scripts/python -m pipeline.load
```

거점 목록은 `data/manual/hubs.csv`에서 읽는다. 이 파일만 고쳤으면 run_all 전체가 아니라 `python -m pipeline.times`, `python -m pipeline.validate`, `python -m pipeline.load` 세 개만 다시 실행하면 된다.

거점 후보 점수를 다시 내려면 `python -m pipeline.hubs` (카카오 키 필요, 약 4,500회 호출 (646그룹 x 7회)).
적재 후 서버를 재시작해야 시간표 캐시가 갱신된다.

## 배포 (Railway)

- 인터프리터는 `.python-version`의 3.12로 고정된다. 빌더가 이 파일을 읽는다.
- start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- 첫 배포 때 `python -m scripts.init_db` 를 한 번 실행해 테이블을 만든다.
- 역 데이터를 적재한 뒤에는 서비스를 재시작한다. 시간표를 프로세스 메모리에 올리기 때문이다.
- Supabase 첫 적재 순서: 테이블 정리(이전 버전 스키마가 있을 때만, 위 "데이터 적재" 참고), `python -m scripts.init_db`, `python -m pipeline.load`(로컬에서 `.env`의 `DATABASE_URL`을 Supabase로 두고 실행), 서비스 재시작. 적재 후 기존 방의 참가자 출발역 id가 바뀔 수 있어 결과가 달라질 수 있으니 적재는 사용량이 적을 때 한다.
- cron: `python -m scripts.cleanup_expired` 를 하루 한 번.
- `/health` 는 DB를 건드리지 않는다. 헬스체크가 DB 장애에 끌려가지 않는다.

## 운영

- 만료 방 정리: `python -m scripts.cleanup_expired` 를 하루 한 번 (Railway cron). 만료된 방과 30일 넘은 콘텐츠 캐시를 함께 지운다.
- 역간 시간표는 프로세스 시작 후 첫 결과 요청 때 메모리에 올라간다. 데이터 갱신 후에는 재시작한다.
