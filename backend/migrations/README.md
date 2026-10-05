# DB 구조 변경

마이그레이션 도구를 쓰지 않는다. 변경 SQL을 이 폴더에 번호 순서로 두고, 운영 DB(Supabase)에는 SQL 편집기에서 순서대로 실행한다.

## 규칙

- 파일 이름은 `NNN_설명.sql`. 한 번 운영에 적용한 파일은 고치지 않고 새 번호로 더한다.
- 모델(`app/models.py`)을 바꾸는 커밋에 SQL 파일을 함께 넣는다.
- 방, 참가자, 통계 표(`rooms`, `participants`, `daily_stats`)는 지우지 않는다. 열을 더할 때는 null을 허용하거나 기본값을 주어 기존 행이 깨지지 않게 한다.
- 역, 거점, 시간표, 콘텐츠 캐시(`station_groups`, `stations`, `hubs`, `station_times`, `content_cache`)는 `python -m pipeline.load`로 언제든 다시 적재할 수 있다.
- 새 표를 만들면 `001_enable_rls.sql`처럼 그 표에도 RLS를 켜는 문장을 같은 파일에 넣는다.
- SQL은 Postgres 기준으로 쓴다. 로컬 SQLite는 `dev.db`를 지우고 `scripts.init_db`로 다시 만든다.

## 새 DB를 만들 때

로컬에서 `backend/` 폴더 안에서 실행한다. 그 셸에서만 `DATABASE_URL` 환경 변수에 Supabase 세션 모드 연결 문자열을 지정한다(환경 변수가 `.env`보다 우선하므로 `.env` 파일은 건드리지 않는다).

1. `python -m scripts.init_db` (현재 모델대로 모든 표 생성)
2. `001_enable_rls.sql` 실행 (Supabase SQL 편집기에서, 또는 같은 연결로)
3. `python -m pipeline.load`

`init_db`가 최신 모델로 표를 만들기 때문에, 새 DB에는 그 뒤 번호의 열 추가 SQL을 실행할 필요가 없다. 번호가 붙은 변경 SQL은 이미 돌고 있는 DB를 따라오게 하는 용도다.

## 적용 기록

| 번호 | 운영 적용일 | 내용 |
|---|---|---|
| 001 | 2026-10-05 | 모든 표에 RLS (8개 표 모두 켜진 것을 확인) |
