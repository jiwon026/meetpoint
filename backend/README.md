# 우리지금만나 백엔드

## 로컬 실행

```bash
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"
copy .env.example .env
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
| DATABASE_URL | Postgres 연결 문자열. 로컬 기본값은 sqlite:///./dev.db |
| KAKAO_REST_KEY | 카카오 개발자 콘솔의 REST API 키 (지오코딩, 로컬 검색) |
| SEOUL_API_KEY | 서울 열린데이터광장 인증키 (문화행사) |
| KOPIS_API_KEY | 공연예술통합전산망 서비스키 |
| CORS_ORIGINS | 프론트 주소. 쉼표로 여러 개 |

## 데이터 적재

stations, station_times, hubs 테이블은 별도 데이터 파이프라인 계획(dev/active/transit-data)에서 채운다.
그 전까지는 tests/conftest.py의 시드와 같은 형태로 수동 적재해서 확인할 수 있다.

## 운영

- 만료 방 정리: `python -m scripts.cleanup_expired` 를 하루 한 번 (Railway cron)
- 역간 시간표는 프로세스 시작 후 첫 결과 요청 때 메모리에 올라간다. 데이터 갱신 후에는 재시작한다.
