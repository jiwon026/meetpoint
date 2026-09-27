# transit-data 설계 문서: 수도권 지하철 그래프와 거점 데이터 파이프라인

작성일: 2026-09-27
상태: 설계 확정, 구현 계획 작성 전
상위 문서: `docs/design.md` (6절 추천 알고리즘, 7절 콘텐츠 출처)

## 0. 한 줄 요약

공공데이터로 수도권 지하철 역 노드와 인접 간선 그래프를 만들고, 모든 역에서 만남 거점까지의 최단 소요시간과 거점 100곳을 CSV로 산출해 백엔드 DB에 적재하는 파이프라인.

## 1. 왜 필요한가

백엔드(`backend/`)는 `stations`, `station_times`, `hubs` 테이블이 채워져 있어야 실제 추천을 낸다. 지금은 테스트 시드(역 6개, 거점 4개)만 있다. 또한 백엔드 최종 리뷰에서 "거점과 역을 이름으로 묶는 방식"이 결함으로 판정됐다. 신촌(2호선)과 신촌(경의중앙선)은 1.4km 떨어진 다른 역이고, 양평(5호선)과 양평(경의중앙선)은 50km 떨어져 있다. 이 문서는 그 해결(역 그룹 키)도 포함한다.

## 2. 확정된 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 소요시간 출처 | 1~8호선은 서울교통공사 실측(분), 나머지는 거리 기반 추정 | 실측이 있는 노선이 1~8호선뿐. 공평함 비교 용도에는 구간별 균일한 추정 오차가 결과 순위에 거의 영향 없음 |
| 역 순서와 거리 출처 | 국가철도공단 노선별 역간거리 파일 (인접 역 쌍 + km) | 역 순서 정보를 겸함 |
| 데이터 없는 6개 노선 | 우이신설, 신림, 김포골드, 의정부경전철, 서해선, GTX-A는 역 순서를 수동 파일로 작성해 포함 | 약 70개 역. 김포, 안산 방면 사용자에게 중요 |
| 역 그룹 규칙 | 정규화 이름이 같고 500m 이내인 노드를 한 그룹으로. 별칭 파일로 예외 처리 | 신촌, 양평 문제를 데이터로 해결. 이름 매핑 코드 제거 |
| 거점 선정 | 카카오 로컬 장소 개수로 상위 150곳 자동 추출 후, 지역 균형을 맞춰 100곳 초안 작성, 사용자가 CSV 검토 | 사람 손과 자동 점수의 절충 |
| 산출물 보관 | 원본 파일과 결과 CSV를 `backend/data/`에 커밋, 적재 스크립트로 DB 반영 | 키나 외부 접근 없이 재현 가능, 리뷰 가능, 배포 단순 |
| 원본 다운로드 | 수동. `SOURCES.md`에 URL과 날짜 기록 | 공공데이터포털 파일 다운로드가 로그인을 요구할 수 있음 |
| station_times 크기 | 거점 그룹에 속한 노드를 목적지로 하는 행만 저장 | 700 x 200 = 약 14만 행. 전체 49만 행은 불필요 |

## 3. 데이터 출처

조사일 2026-09-27 기준. 컬럼명은 포털 페이지 설명 기준이며 실제 파일을 열어 재확인하는 것이 첫 태스크다.

| 용도 | 데이터셋 | URL | 형식 | 비고 |
|---|---|---|---|---|
| 역 좌표 (전 노선) | 국가철도공단 전국도시철도역사정보표준데이터 | https://www.data.go.kr/data/15013205/standard.do | XLSX | 약 1,073건. 컬럼: 역번호, 역사명, 노선번호, 노선명, 환승역 여부, 환승 노선, 위도, 경도, 운영기관명 등. 경전철 5개사 포함 여부는 파일에서 확인 |
| 1~8호선 역 순서, 거리, 실측 분 | 서울교통공사 역간거리 및 소요시간 | https://data.seoul.go.kr/dataList/OA-12034/S/1/datasetView.do | CSV | 컬럼: 연번, 호선, 역명, 운행시간(분), 역간거리(km), 호선별누계(km) |
| 그 외 노선 역 순서와 거리 | 국가철도공단 OO 역간거리 시리즈 | 예: 경강선 https://www.data.go.kr/data/15041296/fileData.do, 9호선 15041298, 인천교통공사 15081857, 인천2호선 15081856, 공항철도 15041310, 에버라인 15081850, 수도권1호선 15041460, 코레일 15081858, 수도권5호선 15041348 | CSV | 컬럼: 철도운영기관명, 선명, 역명, 역간거리, 후행역간거리. 신분당선, 경의중앙선, 수인분당선, 경춘선은 포털에서 검색해 URL 확정 |
| 환승 도보시간 | 서울교통공사 환승역거리 소요시간 정보 | https://www.data.go.kr/data/15044419/fileData.do | CSV | 145개 역. 컬럼: 연번, 호선, 환승역명, 환승노선, 환승거리, 환승소요시간 |
| 거점 점수 | 카카오 로컬 API | 이미 백엔드에 클라이언트 있음 | HTTP | 그룹당 3~7회 호출, 총 600그룹 이하 |

라이선스는 전부 공공누리 1유형(출처 표시) 또는 이용허락범위 제한 없음. `SOURCES.md`에 출처 표시 문구를 적는다.

## 4. 파일 배치

```
backend/
  pipeline/                  파이프라인 패키지 (python -m pipeline.<단계>)
    __init__.py
    config.py                상수: 수도권 경계, 속도 계수, 그룹 반경, 파일 경로
    names.py                 역 이름 정규화
    stations.py              표준데이터 파싱 -> stations.csv
    edges.py                 노선별 인접 간선 -> edges.csv
    estimate.py              거리 -> 분 추정 공식과 보정
    groups.py                역 그룹 묶기, 환승 간선 -> station_groups.csv, transfers.csv
    times.py                 다익스트라 -> station_times.csv
    hubs.py                  카카오 점수 -> hub_candidates.csv
    validate.py              검증 규칙
    load.py                  CSV -> DB
    run_all.py               stations -> edges -> groups -> times -> validate 순차 실행
  data/
    SOURCES.md
    raw/                     원본 그대로
    manual/
      line_orders.csv        노선, 순번, 역명 (6개 노선)
      station_aliases.csv    정규화 이름 A, 정규화 이름 B (같은 역으로 취급)
      line_classes.csv       노선명, 등급(urban, regional, gtx)
      hubs.csv               그룹 id, 이름, 지역, 태그(세미콜론 구분), 분위기 한 줄
    out/
      stations.csv
      station_groups.csv
      edges.csv
      transfers.csv
      station_times.csv
      hub_candidates.csv
  tests/pipeline/            파이프라인 테스트
```

## 5. 단계별 처리

### 5.1 stations

입력: `raw/` 표준데이터 XLSX.
처리:
- 위도 36.9~38.3, 경도 126.3~127.9 안에 있고, 노선명이 수도권 노선 목록(`config.py`)에 있는 행만 남긴다.
- 이름 정규화(`names.py`): 앞뒤 공백 제거, 괄호와 그 안 내용 제거("총신대입구(이수)" -> "총신대입구"), 끝의 "역" 제거, 전각 공백 제거. 원문 이름도 별도 컬럼으로 보존.
- 노드 id는 1부터 순번. 같은 이름과 노선이 중복되면 실패.
출력: `stations.csv` (id, name, raw_name, line, operator, lat, lng). group_id는 5.4에서 채운다.

### 5.2 edges

입력: stations.csv, 1~8호선 CSV, 국가철도공단 역간거리 CSV들, manual/line_orders.csv.
처리:
- 노선별로 역 순서 목록을 만든다. 1~8호선은 서울교통공사 파일의 연번 순서. 국가철도공단 파일은 파일 행 순서(인접 쌍). 6개 노선은 manual 순번.
- 각 역명을 정규화해 `stations.csv`의 (name, line) 노드에 매칭한다. 노선명 표기 차이(예: "2호선"과 "서울 2호선")는 `config.py`의 노선명 별칭 표로 흡수한다.
- 매칭 안 되는 이름이 하나라도 있으면 전체 목록을 출력하고 실패한다.
- 인접 쌍마다 간선을 만든다. 거리는 파일의 km, 없으면 좌표 직선거리 x 1.15. 실측 분이 있으면 `source=measured`, 없으면 5.3으로 추정하고 `source=estimated`.
- 지선(2호선 성수지선과 신정지선, 5호선 마천지선, 경의중앙선 서울역 방면 등)은 원본 파일에 별도 구간으로 들어 있다고 가정하고, 5.7의 연결성 검증으로 누락을 잡는다.
출력: `edges.csv` (from_id, to_id, line, km, minutes, source). 무방향이므로 한 쌍당 한 행.

### 5.3 시간 추정 (estimate.py)

```
minutes = max(1.0, km / speed_kmh * 60 + DWELL_MIN)
```
- `DWELL_MIN = 0.5`
- 등급별 속도: urban 32 km/h, regional 45 km/h, gtx 80 km/h. 등급은 `manual/line_classes.csv`.
- 보정: 1~8호선 실측(분)과 거리(km)로 urban 속도를 최소제곱으로 추정해 결과를 출력한다. 상수와 15% 넘게 차이 나면 상수를 그 값으로 갱신하고 문서에 기록한다. 보정은 파이프라인 실행 시 자동으로 하지 않고, `python -m pipeline.estimate --calibrate`로 사람이 확인한 뒤 상수를 바꾼다.
- 결과는 소수 1자리로 저장. 다익스트라는 실수로 계산하고 최종 시간표는 반올림 정수.

### 5.4 groups

입력: stations.csv, 환승역 CSV, manual/station_aliases.csv.
처리:
- 정규화 이름이 같은(또는 별칭으로 연결된) 노드들 중 서로 500m 이내인 것을 union-find로 묶는다. 500m는 `config.py` 상수.
- 그룹 id는 1부터 순번. 그룹 대표 이름은 가장 많은 노드가 쓰는 이름, 중심 좌표는 노드 좌표 평균.
- 같은 그룹 안 노드 쌍마다 환승 간선을 만든다. 환승 시간은 서울교통공사 환승역 파일에 (역명, 호선, 환승노선) 쌍이 있으면 그 값(분), 없으면 4분.
- stations.csv에 group_id를 채운다.
출력: `station_groups.csv` (id, name, lat, lng, node_count), `transfers.csv` (from_id, to_id, minutes, source).

### 5.5 times

입력: stations.csv, edges.csv, transfers.csv, manual/hubs.csv.
처리:
- 인접 리스트를 만들고(간선과 환승 간선 모두 양방향) 모든 노드에서 다익스트라(heapq)를 돌린다. 700개 노드에서 수 초.
- 목적지는 hubs.csv의 그룹에 속한 노드만 저장한다.
- 같은 노드는 0분. 도달 불가 쌍은 저장하지 않는다(백엔드가 None으로 처리).
출력: `station_times.csv` (from_station_id, to_station_id, minutes) 정수.

### 5.6 hubs

입력: station_groups.csv, 카카오 REST 키(.env).
처리:
- 그룹마다 중심 좌표 반경 600m 카테고리 검색(FD6 음식점, CE7 카페)의 `meta.total_count`와, 놀거리 키워드 5개(백엔드 `PLAY_KEYWORDS`와 동일)의 total_count 합을 구한다.
- 점수 = 음식점 x 1 + 카페 x 1 + 놀거리 x 3. 놀거리 가중치가 큰 이유는 "놀 게 있는 동네"를 고르는 것이 목적이기 때문.
- 상위 150곳을 `hub_candidates.csv` (group_id, name, region, food, cafe, play, score)로 저장한다. region은 좌표로 판정(서울 경계 다각형 대신 시군구 판정이 어려우므로, 표준데이터의 도로명주소 앞 두 글자 "서울", "경기", "인천"을 그룹 대표 노드에서 가져온다).
- 카카오 호출 결과는 `out/hub_scores_cache.json`에 그룹별로 저장해 중단 후 재실행 시 이어서 한다.
- 초안 작성: 후보 150곳에서 서울 60, 경기 30, 인천 10 안팎으로 100곳을 고르고 태그 3개와 분위기 한 줄을 써서 `manual/hubs.csv`를 만든다. 이 단계는 사람(또는 계획 실행 시 에이전트)이 하며, 사용자가 파일을 검토해 고친다.
출력: `hub_candidates.csv`, `manual/hubs.csv`.

### 5.7 validate

전부 통과해야 load로 넘어간다. 실패 시 어느 규칙이 어떤 행에서 깨졌는지 출력한다.
- 모든 노드 좌표가 수도권 경계 안.
- 인접 간선 거리: urban 5km 이하, regional 12km 이하, gtx 25km 이하.
- 그래프 연결성: 연결 성분이 2개 이상이면 성분별 노드 수와 예시 역 이름을 출력하고 실패. (실제로 떨어진 노선이 있으면 `config.py`의 허용 목록에 명시적으로 등록해야 통과.)
- hubs.csv의 모든 group_id가 station_groups.csv에 존재하고 노드가 1개 이상.
- station_times.csv에 (모든 출발 노드) x (모든 거점 노드) 행이 존재. 도달 불가가 있으면 목록 출력하고 실패.
- 상식 검증(분): 홍대입구 -> 강남 30~45, 잠실 -> 강남 12~20, 수원 -> 강남 50~75, 부평 -> 서울역 45~70, 판교 -> 강남 15~30. 그룹 대표 노드 기준 최소값.
- 같은 이름 다른 그룹 목록 출력(신촌, 양평 등). 실패는 아니고 사람이 확인하는 리포트.

### 5.8 load

입력: out/ CSV 5개, `DATABASE_URL`.
처리:
- 트랜잭션 안에서 `station_times`, `hubs`, `stations`, `station_groups` 순으로 비우고, `station_groups`, `stations`, `hubs`, `station_times` 순으로 넣는다. SQLAlchemy Core `insert().values()` 배치(1,000행 단위).
- hubs의 station_id는 그룹 대표 노드(그룹 안 id 최소 노드).
- 끝나면 각 테이블 행 수를 출력한다.
- 로컬 SQLite와 Supabase 둘 다 같은 명령. `.env`의 `DATABASE_URL`로 대상이 정해진다.

## 6. 백엔드 변경

| 파일 | 변경 |
|---|---|
| `app/models.py` | `StationGroup(id, name, lat, lng)` 추가. `Station.group_id`, `Hub.group_id` 컬럼 추가(FK, index) |
| `app/hubs.py` | `load_hub_candidates`가 이름 대신 `Hub.group_id == Station.group_id`로 노드를 묶음 |
| `tests/conftest.py` | 시드에 그룹 4개 추가, 역과 거점에 group_id 부여 |
| `scripts/init_db.py` | 변경 없음 (create_all이 새 테이블 생성). 기존 DB는 테이블을 지우고 다시 만든다 (MVP, 마이그레이션 없음) |
| `backend/README.md` | 데이터 적재 절차를 파이프라인 명령으로 갱신 |

`compute_result`와 API 응답 형식은 바뀌지 않는다.

## 7. 에러 처리

| 상황 | 처리 |
|---|---|
| raw 파일 없음 | 파일명, 다운로드 URL, 저장 경로를 출력하고 종료 코드 2 |
| 컬럼명이 예상과 다름 | 실제 헤더를 출력하고 실패. 파서의 컬럼 별칭 표를 고쳐 재실행 |
| 역명 매칭 실패 | 실패한 (노선, 역명) 전체 목록 출력 후 실패 |
| 거리 이상, 연결 끊김, 상식 검증 실패 | validate에서 명시적 실패 |
| 카카오 API 실패 | 지금까지의 점수를 캐시 파일에 남기고 중단. 재실행 시 이어서 |
| 적재 중 DB 오류 | 트랜잭션 롤백, 기존 데이터 유지 |

조용히 넘어가는 경우는 없다. 경고만 남기는 것은 "같은 이름 다른 그룹" 리포트뿐이다.

## 8. 테스트

- `names.py`: 괄호 제거, "역" 제거, 공백 처리.
- `stations.py`: 표준데이터 몇 행을 담은 픽스처 XLSX로 컬럼 매핑과 수도권 필터.
- `edges.py`: 픽스처 CSV로 1~8호선 파서, 국가철도공단 파서, manual 파서 각각. 매칭 실패 시 예외와 목록.
- `estimate.py`: 공식 값, 최소 1분, 등급별 속도, 보정 함수.
- `groups.py`: 같은 이름 300m(묶임), 같은 이름 1.4km(분리), 별칭, 환승 시간 조회와 기본값.
- `times.py`: 6노드 소형 그래프에서 다익스트라 결과, 환승 페널티 반영, 도달 불가.
- `validate.py`: 규칙별로 통과와 실패 케이스 하나씩.
- `load.py`: SQLite 인메모리에 적재 후 백엔드 `compute_result`가 실제로 추천을 내는지 통합 확인.
- `run_all`: 합성 소형 데이터(역 12개, 노선 3개, 환승 2곳)로 stations부터 validate까지 한 번에.
- 실제 원본 파일로 도는 것은 수동 실행이며 validate 통과가 증명이다.

## 9. 단계 밖 (다음에)

- 9호선과 코레일 노선의 실측 시간을 시간표 API로 역산해 추정을 대체
- KOPIS 공연장 좌표 사전 적재 (venues 테이블)
- 노선 개통과 연장 반영 절차 (원본 갱신 후 파이프라인 재실행)

## 10. 열어둔 질문

- 표준데이터 파일에 경전철 5개사(우이신설, 신림, 김포골드, 의정부, 용인)의 역이 들어 있는지. 없으면 노선별 "역위치" 파일로 보충.
- 공항철도 역간거리 파일에 소요시간이 있는지(페이지 설명이 모순됨). 있으면 measured로 사용.
- 분당선 역간거리 파일이 수인선 파일에 통합돼 있는지.
