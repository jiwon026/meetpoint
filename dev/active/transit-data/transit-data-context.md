# transit-data 컨텍스트

Last Updated: 2026-09-28 (계획 작성 완료, 구현 전)

## 이 태스크가 뭔가

수도권 지하철 그래프와 만남 거점 데이터를 만드는 파이프라인. 설계는 `docs/transit-data-design.md`, 계획은 같은 폴더의 `transit-data-plan.md`. 백엔드(`backend/`)가 실제 추천을 내려면 이 데이터가 필요하다.

## 상태

- 백엔드 1단계는 `main`에 병합됨 (테스트 90개, `/health`, `POST /rooms` 확인).
- 카카오 REST 키는 `backend/.env`에 있고 카카오맵 서비스 사용 설정도 켜져 있음 (지오코딩, 장소 검색 확인 완료).
- 서울 열린데이터광장 키, KOPIS 키는 아직 없음 (행사 탭에만 필요, 이 계획과 무관).
- 브랜치: 계획 실행 시 `feat/transit-data`를 `main`에서 만든다.

## 핵심 파일

| 파일 | 역할 |
|---|---|
| `docs/transit-data-design.md` | 확정 설계. 3절 데이터 출처 URL, 5절 단계별 규칙 |
| `dev/active/transit-data/transit-data-plan.md` | 태스크 15개. 1~12는 코드(TDD), 13~15는 실제 데이터 실행과 판단 |
| `backend/pipeline/config.py` | 상수와 노선 별칭, 컬럼 별칭. 실제 파일 헤더에 맞춰 Task 3, 13에서 보정 |
| `backend/data/manual/hubs.csv` | 거점 100곳. 사용자가 검토하는 파일 |
| `backend/data/SOURCES.md` | 원본 출처와 확인된 사실 기록 |

## 확정된 결정

- 소요시간: 1~8호선은 서울교통공사 실측, 나머지는 거리 기반 추정 (urban 32, regional 45, gtx 80 km/h, 정차 0.5분). 1~8호선 실측으로 urban 속도 보정 후 상수 갱신 여부 판단.
- 역 그룹: 정규화 이름 같고 500m 이내면 한 그룹. 별칭 파일로 예외. 백엔드 매핑을 이름에서 group_id로 교체 (Task 1).
- 데이터 없는 6개 노선(우이신설, 신림, 김포골드, 의정부경전철, 서해선, GTX-A)은 역 순서를 수동 파일로.
- 거점: 카카오 장소 개수 점수 상위 150곳에서 지역 균형 맞춰 100곳 초안, 사용자 검토.
- 산출물 CSV와 원본을 저장소에 커밋, `pipeline.load`로 DB 적재. 원본 다운로드는 수동.
- station_times는 거점 노드 목적지 행만 저장 (약 14만 행).

## 알려진 불확실성 (Task 3, 13, 15에서 해소)

- 공공데이터포털 파일 다운로드에 로그인이 필요한지. 필요하면 사용자가 받아서 `backend/data/raw/`에 넣어야 한다.
- 표준데이터에 경전철 5개사 역이 있는지. 없으면 `manual/extra_stations.csv`로 보충.
- 서울교통공사 운행시간이 "분" 정수인지 "분:초"인지 (파서는 둘 다 처리).
- 공항철도 파일에 소요시간 컬럼이 있는지.
- 1호선 코레일 구간(경인선 등)이 국가철도공단 파일에서 어떤 노선명으로 들어 있는지.
- 지선 구간이 원본에서 별도 세그먼트로 시작하는지 (0분, 0km 행으로 판단).

## 다음 계획에 넘길 것

- frontend: 결과 화면, 지도, 폴링. `hub_content` 응답 스키마 `ContentOut` 사용.
- 운영: Supabase에 `pipeline.load`, Railway 재시작.
- 후속: 9호선과 코레일 노선 실측 시간을 시간표 API로 역산, KOPIS 공연장 좌표 사전 적재.
