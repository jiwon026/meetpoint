# 우리지금만나 백엔드

## 로컬 실행

```bash
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

stations, station_times, hubs 테이블은 별도 데이터 파이프라인 계획(dev/active/transit-data)에서 채운다.
그 전까지는 tests/conftest.py의 시드와 같은 형태로 수동 적재해서 확인할 수 있다.

## 배포 (Railway)

- 인터프리터는 `.python-version`의 3.12로 고정된다. 빌더가 이 파일을 읽는다.
- start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- 첫 배포 때 `python -m scripts.init_db` 를 한 번 실행해 테이블을 만든다.
- 역 데이터를 적재한 뒤에는 서비스를 재시작한다. 시간표를 프로세스 메모리에 올리기 때문이다.
- cron: `python -m scripts.cleanup_expired` 를 하루 한 번.
- `/health` 는 DB를 건드리지 않는다. 헬스체크가 DB 장애에 끌려가지 않는다.

## 운영

- 만료 방 정리: `python -m scripts.cleanup_expired` 를 하루 한 번 (Railway cron). 만료된 방과 30일 넘은 콘텐츠 캐시를 함께 지운다.
- 역간 시간표는 프로세스 시작 후 첫 결과 요청 때 메모리에 올라간다. 데이터 갱신 후에는 재시작한다.
