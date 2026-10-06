# deploy 컨텍스트

Last Updated: 2026-10-07

## 무엇을 하는가

무료 구간(Vercel, Render, Supabase)에 서비스를 올려 지인이 쓰게 한다(1단계). 설계 `docs/deploy-design.md`, 계획 `deploy-plan.md`(8개 태스크: 코드 1~6, 배포 파일 7, 실제 배포 8). 홍보(2단계)와 포트폴리오(3단계)는 설계 6절, 7절에 방향만 있고 이 계획의 범위가 아니다.

## 핵심 파일

| 파일 | 역할 |
|---|---|
| `docs/deploy-design.md` | 확정한 결정, 구성, 환경 변수, 운영 점검 목록 |
| `render.yaml` | Render 서비스 정의 (Task 7에서 만든다) |
| `.github/workflows/ci.yml`, `cleanup.yml` | 테스트 자동 실행, 만료 방 정리 예약 (Task 7) |
| `backend/migrations/` | RLS SQL과 DB 구조 변경 규칙 (Task 7) |
| `backend/app/stats.py`, `backend/scripts/stats.py` | 규모 통계 기록과 출력 (Task 4) |
| `backend/.env.production` | 운영 DB 연결 문자열. 커밋하지 않는다 (Task 8에서 사용자가 만든다) |

## 사용자와 정한 것 (2026-10-05)

- 출시 순서: 지인 테스트, 홍보로 데이터 쌓기, 포트폴리오 공개.
- 로그인은 만들지 않는다. 남을 빼버리는 불편이 실제로 나오면 참가자 본인 토큰부터.
- 무료로 시작하고 홍보 단계에서 백엔드를 유료로 올린다.
- 주소는 `*.vercel.app` 무료 주소로 시작한다. 자체 도메인은 홍보 전에 결정.
- 통계는 서버가 세는 규모 숫자로 시작하고, 홍보 전에 Amplitude(익명 이벤트만)를 붙여 지인 사용으로 검증한 뒤 홍보를 시작한다. 지인 테스트 단계에는 Amplitude를 붙이지 않는다.
- 커밋과 PR에 Claude 공동 작성자 표기를 넣는다 (2026-10-03부터).

## 설계하며 내린 결정

- 백엔드는 Railway가 아니라 Render. Railway에는 무료 구간이 없다. 이전 문서(`docs/design.md`, `backend/README.md`)의 Railway 언급은 Task 7에서 고친다.
- Supabase와 Render를 둘 다 싱가포르에 둔다. 사용자는 DB에 직접 닿지 않으므로 백엔드와 DB 사이 거리가 중요하다.
- Supabase는 세션 모드 풀러로 붙는다. 직접 연결은 IPv6 전용이다.
- "추천 조회 수" 대신 "추천까지 간 방 수"를 센다. 추천 화면이 10초마다 다시 불러서 조회 수는 의미가 없다.
- 만료 방 삭제는 GitHub Actions. Render 무료에는 cron이 없고, 저장소가 비공개라 10분 간격 깨우기에는 Actions 시간이 모자라 깨우기는 UptimeRobot에 맡긴다.
- 마이그레이션 도구를 들이지 않는다. `backend/migrations/`에 SQL을 번호 순서로 둔다.
- Supabase Data API를 끄고 모든 표에 RLS를 켠다. 우리는 그 API를 쓰지 않는다.
- `robots.txt`는 `/r/`를 막지 않는다. 막힌 크롤러는 방 페이지의 `noindex`를 읽지 못하고, 링크 미리보기 수집기는 robots.txt를 따르면 제목 미리보기를 잃을 수 있다. 검색 제외는 `noindex, nofollow` 메타 태그만으로 한다.
- `/health`는 GET과 HEAD 둘 다 받는다. 무료 요금제의 UptimeRobot이 HEAD로 확인하기 때문이다.
- 엔진은 `hide_parameters=True`로 만든다. DB 오류 문구에 닉네임, 좌표 같은 행 값이 실려 로그로 새지 않게 한다.

## 미리 아는 위험

- 서울시와 KOPIS 행사 API가 해외(싱가포르) 요청을 막을 수 있다. KOPIS는 2026-10-03에 국내 PC에서도 짧은 시간에 여러 번 부르자 `400 Request Blocked`를 돌려줬다. 올린 직후 가장 먼저 확인한다.
- CI는 Linux와 Python 3.12, 로컬은 Windows와 Python 3.14다. CI에서 처음 드러나는 실패가 있을 수 있다.
- Vercel Hobby는 비상업 용도 조건이다. 광고나 수익화를 붙이면 유료로 가야 한다.

## 배포 결과 (2026-10-06)

- 프론트 https://meetpoint-kappa.vercel.app , 백엔드 https://meetpoint-api-34hf.onrender.com , DB는 Supabase(싱가포르, Postgres 17).
- 점검 결과는 `docs/deploy-design.md` 5.1절.
- 미리 걱정한 위험 중 "행사 API가 해외 서버를 막는다"는 해당 없음으로 확인됐다. 서울시와 KOPIS 모두 싱가포르에서 응답한다.
- CI 첫 실행에서 `npm ci`가 실패했다. Windows의 npm 11.6.1이 만든 잠금 파일에 `@emnapi/core`, `@emnapi/runtime`이 빠져 있었고, npm 11.21로 다시 만들어 해결했다. 잠금 파일을 갱신할 때는 `npx npm@11 install --package-lock-only`로 하고 `npx npm@11 ci --dry-run`으로 확인한다.
- Render 서비스 이름 `meetpoint-api`는 이미 쓰이고 있어 주소에 `-34hf`가 붙었다.
- 운영 DB에 점검용 방 3개(참가자 7명)가 있고 2026-10-06 통계에 들어 있다. 방은 약속 7일 뒤에 지워진다.

## 배포 뒤 바로 할 것

- 경기와 인천 행사 0건 버그는 2026-10-07에 고쳐 운영에서 확인했다 (`docs/deploy-design.md` 8절).
- Render 자동 배포가 한 번 안 된 원인: 병합 직후 수동 실행한 `warm-venues` 작업이 같은 커밋에 실패 검사로 붙었기 때문이다 (`docs/deploy-design.md` 8절). 병합 뒤에는 배포를 확인한 다음에 예약 작업을 수동 실행한다.
- 사용자 확인 항목(잠든 서버 안내 문구, UptimeRobot 등록, 카카오톡 링크 미리보기)은 2026-10-07에 모두 마쳤다.

## 지인 테스트 의견 (2026-10-07부터)

- "둘러보기에 인기순, 리뷰순, 별점순이 있으면 좋겠다": 별점 데이터를 주는 공식 API가 없어 추천순(카카오 정확도순)과 가까운 순을 넣었다 (PR #6). 진짜 별점순이 필요하면 구글 장소 데이터를 따져봐야 한다(비용, 한국 리뷰 수, 저장 약관).
- "추천 장소에서 각자 출발지부터의 대중교통 노선이 나오면 좋겠다": 먼저 사람마다 카카오맵 대중교통 길찾기 링크를 넣었다. 이어서 할 일: 카드 안에 노선과 환승역 요약을 직접 보여주기. 지금은 `pipeline/times.py`가 최단 시간만 남기고 경로를 버린다. 경로(탄 노선의 순서와 환승역)를 함께 남기도록 파이프라인을 고치고, `station_times`에 열을 더하거나 표를 새로 두고(`backend/migrations/`에 SQL), 운영 DB에 다시 적재하고, 결과 응답의 `legs`에 경로를 싣고, 카드에 그린다. 지하철 기준이라 버스 구간은 나오지 않는다. 계획을 세워서 한다.

## 다음 계획에 넘길 것 (2단계)

`docs/deploy-design.md` 6절의 순서를 따른다: Amplitude 연결과 검증, 개인정보 안내 페이지, 호출 제한, 카카오톡 공유 미리보기, 백엔드 유료 전환, 자체 도메인 결정, 참가자 본인 토큰, 오류 감시.

프론트 계획에서 넘어온 것 중 이번에 하지 않는 것: 404와 410 뒤 폴링 멈추기, 접근성 보강, 테스트의 실시간 대기 제거 등 `dev/active/frontend/frontend-context.md`의 "최종 리뷰에서 나중으로 미룬 것".
