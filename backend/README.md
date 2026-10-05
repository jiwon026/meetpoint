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
| DATABASE_URL | Postgres 연결 문자열. 로컬 기본값은 sqlite:///./dev.db. Supabase가 주는 `postgresql://...` 그대로 넣으면 된다. 내부에서 `postgresql+psycopg://`로 바꾼다. Supabase는 세션 모드(`pooler.supabase.com:5432`) 문자열을 쓴다. |
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

운영 DB(Supabase)를 새로 만드는 순서는 `migrations/README.md`를 따른다. RLS 단계가 들어 있다.

`scripts.init_db`는 기존 테이블에 컬럼을 추가하지 않는다. 가장 최근 스키마 변경(2026-10)은 `rooms.regions`, `rooms.theme`, `rooms.first_result_at`, `participants.active`, `hubs.themes`, 그리고 새 표 `daily_stats`다. 그래서 이 변경 이전에 만든 로컬 `dev.db`는 파일을 지우고 `init_db`를 다시 실행한 뒤 `pipeline.load`로 적재해야 한다. 로컬의 방과 참여자 데이터는 함께 사라지지만 괜찮다.

운영 DB(Supabase)는 표를 지우지 않는다. 구조를 바꿀 때는 `migrations/`의 번호 붙은 SQL을 `migrations/README.md`의 규칙대로 적용한다. 아직 운영 DB가 없으므로 위 변경에 대한 열 추가 SQL은 필요 없다. 첫 운영 DB는 현재 모델로 `init_db`가 만든다.

원본을 갱신했으면 다시 계산한다.

```bash
.venv/Scripts/python -m pipeline.run_all    # stations, edges, groups, times, validate
.venv/Scripts/python -m pipeline.load
```

거점 목록은 `data/manual/hubs.csv`에서 읽는다. 이 파일만 고쳤으면 run_all 전체가 아니라 `python -m pipeline.times`, `python -m pipeline.validate`, `python -m pipeline.load` 세 개만 다시 실행하면 된다.

`hubs.csv`의 `themes` 열 초안은 `python -m pipeline.themes`가 만든다 (비어 있는 행만 채움, `--force`는 전부 다시 계산). 평소에는 손으로 고친다.

거점 후보 점수를 다시 내려면 `python -m pipeline.hubs` (카카오 키 필요, 약 4,500회 호출 (646그룹 x 7회)).
적재 후 서버를 재시작해야 시간표 캐시가 갱신된다.

## 배포 (Render)

설계와 순서는 `docs/deploy-design.md`. 서비스 정의는 저장소 루트의 `render.yaml`이다.

- 무료 플랜, 싱가포르. 15분 동안 요청이 없으면 잠들고 깨는 데 약 1분 걸린다. UptimeRobot이 5분마다 `/health`를 불러 깨워둔다.
- 파이썬 버전은 `render.yaml`의 `PYTHON_VERSION`(3.12.8)이다. 저장소에 있는 `backend/.python-version`(3.12)은 로컬 도구용이고 Render는 읽지 않는다.
- `main`에 올라간 커밋 중 CI(`.github/workflows/ci.yml`)가 통과한 것만 자동으로 배포된다.
- DB는 Supabase의 세션 모드 연결 문자열(`...pooler.supabase.com:5432`)을 쓴다. 직접 연결은 IPv6 전용이라 Render와 가정용 인터넷에서 닿지 않는다. 트랜잭션 모드(6543)는 쓰지 않는다.
- 새 DB를 만드는 순서와 구조 변경 규칙은 `migrations/README.md`.
- 역 데이터를 다시 적재한 뒤에는 서비스를 재시작한다. 시간표를 프로세스 메모리에 올리기 때문이다. 적재 후 기존 방의 참가자 출발역 id가 바뀔 수 있으니 적재는 사용량이 적을 때 한다.
- `/health`는 DB를 건드리지 않는다. 헬스체크가 DB 장애에 끌려가지 않는다.

## 운영

- 만료 방 정리: GitHub Actions의 `cleanup` 워크플로가 하루 한 번 `python -m scripts.cleanup_expired`를 실행한다. 만료된 방과 30일 넘은 콘텐츠 캐시를 함께 지운다. 수동 실행은 `gh workflow run cleanup`.
- 역간 시간표는 프로세스 시작 후 첫 결과 요청 때 메모리에 올라간다. 데이터 갱신 후에는 재시작한다.
- 규모 통계: `python -m scripts.stats`가 `daily_stats`(날짜별 만든 방 수, 등록한 참가자 수, 추천까지 간 방 수)를 출력한다. 날짜는 한국 시간 기준이고 개인 정보는 들어 있지 않다. 방이 지워져도 남는다.
