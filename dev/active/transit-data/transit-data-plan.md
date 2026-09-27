# transit-data 파이프라인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공공데이터로 수도권 지하철 그래프를 만들어 stations, station_groups, edges, station_times, hubs CSV를 산출하고 백엔드 DB에 적재한다. 백엔드의 거점 매핑을 이름에서 그룹 id로 바꾼다.

**Architecture:** `backend/pipeline/` 패키지의 단계별 모듈(stations, edges, groups, times, hubs, validate, load)이 `backend/data/raw/` 원본을 읽어 `backend/data/out/` CSV를 쓴다. 모든 단계는 순수 함수(파싱, 계산)와 얇은 `main()`으로 나뉘어 픽스처로 단위 테스트한다. 실측 소요시간은 1~8호선만 쓰고 나머지는 거리 기반 추정. 물리적으로 같은 역은 이름과 500m 반경으로 묶은 그룹 id로 표현한다.

**Tech Stack:** Python 3.12+, openpyxl(XLSX 읽기), 표준 라이브러리 csv/heapq, SQLAlchemy Core(적재), httpx(카카오), pytest

**Spec:** `docs/transit-data-design.md` (상위: `docs/design.md`)

## Global Constraints

- 모든 명령은 `backend/` 안에서 실행. 테스트는 `.venv/Scripts/pytest`. 파이프라인은 `.venv/Scripts/python -m pipeline.<모듈>`.
- 상수는 전부 `pipeline/config.py`에 둔다: 수도권 경계 위도 36.9~38.3, 경도 126.3~127.9. 그룹 반경 0.5km. 기본 환승 4.0분. 정차 0.5분. 직선거리 우회 계수 1.15. 속도 urban 32, regional 45, gtx 80 km/h. 간선 최대 거리 urban 5, regional 12, gtx 25 km.
- 시간 추정식은 `max(1.0, km / speed_kmh * 60 + 0.5)`, 소수 1자리. 최종 시간표는 반올림 정수.
- 이름 정규화: 괄호와 내용 제거, 공백 제거, 끝의 "역" 제거. 원문은 raw_name으로 보존.
- 실패는 전부 명시적. 역명 매칭 실패, 컬럼 누락, 검증 실패는 목록을 출력하고 0이 아닌 종료 코드. 조용히 건너뛰지 않는다.
- station_times.csv는 거점 그룹에 속한 노드를 목적지로 하는 행만 저장.
- 원본 파일은 `backend/data/raw/`에 커밋. 다운로드는 수동. `backend/data/SOURCES.md`에 URL, 받은 날짜, 라이선스 표기.
- 외부 HTTP 호출은 클라이언트 클래스 안에서만 (`app/places/kakao_local.py`의 `KakaoLocalClient`).
- 문장 부호: 코드 주석, 문구, CSV 내용에 엠대시(—)와 가운데 점(·) 금지.
- 커밋은 conventional commit 형식, 트레일러 없음. 브랜치 `feat/transit-data`.
- 백엔드 API 응답 형식은 바꾸지 않는다. 기존 백엔드 테스트 90개는 계속 통과해야 한다.

## 작업 디렉터리 구조

```
backend/
  pyproject.toml                    openpyxl 의존성 추가
  app/models.py                     StationGroup 추가, Station.group_id, Hub.group_id
  app/hubs.py                       그룹 id 기준 매핑
  app/places/kakao_local.py         count_category, count_keyword 추가
  tests/conftest.py                 시드에 그룹 추가
  pipeline/
    __init__.py
    config.py        상수, 경로, 원본 파일 목록, 노선 별칭, 컬럼 별칭
    io.py            CSV/XLSX 읽기, 컬럼 선택, CSV 쓰기
    names.py         역 이름 정규화
    stations.py      표준데이터 -> stations.csv
    estimate.py      거리 -> 분, 보정
    edges.py         순서 파서 3종 + 간선 생성 -> edges.csv
    groups.py        그룹 묶기, 환승 간선 -> station_groups.csv, transfers.csv, stations.csv(group_id)
    times.py         다익스트라 -> station_times.csv
    validate.py      검증 규칙
    load.py          CSV -> DB
    hubs.py          카카오 점수 -> hub_candidates.csv
    run_all.py       stations -> edges -> groups -> times -> validate
  data/
    SOURCES.md
    raw/
    manual/line_orders.csv, line_classes.csv, station_aliases.csv, hubs.csv
    out/
  tests/pipeline/
    __init__.py
    fixtures/std_stations.xlsx, seoul_times.csv, krail_gyeonggang.csv, transfers.csv
    test_names.py, test_io.py, test_stations.py, test_estimate.py, test_edges.py,
    test_groups.py, test_times.py, test_validate.py, test_load.py, test_hubs.py, test_run_all.py
```

---

### Task 1: 백엔드 모델에 역 그룹 도입

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/hubs.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_hubs.py` (기존 파일에 테스트 추가)

**Interfaces:**
- Produces: ORM `StationGroup(id, name, lat, lng)`; `Station.group_id: int` (FK station_groups.id, index); `Hub.group_id: int` (FK, index); `load_hub_candidates(session)`가 `Hub.group_id == Station.group_id`로 노드를 묶음.
- conftest 시드: 그룹 6개 (역 6개가 각각 자기 그룹, id는 역 id와 동일), 거점 4개는 같은 id의 그룹.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/test_hubs.py` 끝에 추가:
```python
from app.models import Station, StationGroup


def test_hub_nodes_come_from_group_id_not_name(seeded):
    """같은 이름이라도 그룹이 다르면 거점 노드가 아니고, 이름이 달라도 같은 그룹이면 거점 노드다."""
    far_group = StationGroup(id=99, name="신촌", lat=37.5599, lng=126.9426)
    seeded.add(far_group)
    seeded.flush()
    # 이름은 홍대입구인데 그룹은 99: 홍대입구 거점(그룹 1)에 속하면 안 된다
    seeded.add(Station(id=90, name="홍대입구", line="가상선", lat=37.5599, lng=126.9426, group_id=99))
    # 이름은 다른데 그룹은 1: 홍대입구 거점에 속해야 한다
    seeded.add(Station(id=91, name="홍대입구경의", line="경의중앙선", lat=37.5572, lng=126.9250, group_id=1))
    seeded.commit()

    _, candidates = load_hub_candidates(seeded)
    hongdae = next(c for c in candidates if c.name == "홍대입구")
    assert set(hongdae.node_ids) == {1, 91}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_hubs.py -v`
Expected: FAIL, `cannot import name 'StationGroup'`

- [ ] **Step 3: models.py 수정**

`Station` 클래스 앞에 추가:
```python
class StationGroup(Base):
    """물리적으로 같은 역. 환승역은 노선별 Station 여러 개가 한 그룹에 속한다."""

    __tablename__ = "station_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
```

`Station`에 컬럼 추가 (lng 아래):
```python
    group_id: Mapped[int] = mapped_column(ForeignKey("station_groups.id"), index=True)
```

`Hub`에 컬럼 추가 (station_id 아래):
```python
    group_id: Mapped[int] = mapped_column(ForeignKey("station_groups.id"), index=True)
```

- [ ] **Step 4: conftest.py 수정**

import에 `StationGroup` 추가. `seeded` fixture 맨 앞(역 add 전)에:
```python
    session.add_all(
        [StationGroup(id=i, name=n, lat=la, lng=lo) for i, n, l, la, lo in STATIONS]
    )
    session.flush()
```
역 생성에 `group_id=i` 추가:
```python
        [Station(id=i, name=n, line=l, lat=la, lng=lo, group_id=i) for i, n, l, la, lo in STATIONS]
```
거점 생성에 `group_id=sid` 추가 (Hub(...) 인자에 `group_id=sid,`).

`tests/test_cleanup.py`와 `tests/test_events_kopis.py`처럼 `Hub`나 `Station`을 직접 만드는 테스트가 있으면 `group_id`를 채운다. `_suwon_hub`는 `group_id=6`.

- [ ] **Step 5: hubs.py 수정**

`load_hub_candidates` 본문을 다음으로 교체:
```python
    hubs = list(session.scalars(select(Hub).order_by(Hub.id)).all())
    nodes_by_group: dict[int, list[int]] = {}
    for s in all_stations(session):
        nodes_by_group.setdefault(s.group_id, []).append(s.id)
    candidates = [
        HubCandidate(h.id, h.name, tuple(nodes_by_group.get(h.group_id, ()))) for h in hubs
    ]
    return hubs, candidates
```
docstring을 "거점과 같은 그룹(물리적으로 같은 역)에 속한 역 노드 id 묶음."으로 바꾼다.

- [ ] **Step 6: 전체 테스트 통과 확인**

Run: `.venv/Scripts/pytest -q`
Expected: 기존 90개 + 1개 전부 PASS

- [ ] **Step 7: 커밋**

```bash
git add app/models.py app/hubs.py tests/
git commit -m "feat: map hubs to station nodes by group id instead of name"
```

---

### Task 2: 파이프라인 골격 (config, io, names)

**Files:**
- Modify: `backend/pyproject.toml` (openpyxl 추가)
- Create: `backend/pipeline/__init__.py`, `backend/pipeline/config.py`, `backend/pipeline/io.py`, `backend/pipeline/names.py`
- Create: `backend/tests/pipeline/__init__.py`
- Test: `backend/tests/pipeline/test_names.py`, `backend/tests/pipeline/test_io.py`

**Interfaces:**
- Produces (config): `RAW_DIR`, `MANUAL_DIR`, `OUT_DIR` (Path), `METRO_LAT_RANGE`, `METRO_LNG_RANGE`, `GROUP_RADIUS_KM`, `DEFAULT_TRANSFER_MIN`, `DWELL_MIN`, `HAVERSINE_DETOUR`, `SPEED_KMH`, `MAX_EDGE_KM`, `LINE_ALIASES: dict[str, tuple[str, ...]]`, `COLUMNS: dict[str, dict[str, tuple[str, ...]]]`, `RAW_FILES: dict[str, RawFile]`, `KRAIL_DISTANCE_GLOB`, `canonical_line(raw: str) -> str | None`
- Produces (io): `ColumnError(Exception)`, `read_csv_rows(path) -> list[dict[str, str]]`, `read_xlsx_rows(path) -> list[dict[str, str]]`, `pick(row, aliases, required=True) -> str`, `write_csv(path, fieldnames, rows)`, `require_raw(key) -> Path`
- Produces (names): `normalize_station_name(raw: str) -> str`

- [ ] **Step 1: pyproject 의존성 추가**

`dependencies` 목록에 `"openpyxl>=3.1",` 추가 후:
```bash
.venv/Scripts/pip install -e ".[dev]"
```

- [ ] **Step 2: 실패하는 테스트 작성**

`backend/tests/pipeline/__init__.py`: 빈 파일.

`backend/tests/pipeline/test_names.py`:
```python
import pytest

from pipeline.names import normalize_station_name


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("총신대입구(이수)", "총신대입구"),
        ("신촌(경의중앙선)", "신촌"),
        ("서울역", "서울"),
        ("역곡", "역곡"),
        (" 홍대입구 ", "홍대입구"),
        ("동대문역사문화공원", "동대문역사문화공원"),
        ("4.19민주묘지", "4.19민주묘지"),
        ("경기도청북부청사", "경기도청북부청사"),
        ("김포공항\u3000", "김포공항"),
    ],
)
def test_normalize_station_name(raw, expected):
    assert normalize_station_name(raw) == expected
```

`backend/tests/pipeline/test_io.py`:
```python
from pathlib import Path

import pytest

from pipeline.config import canonical_line
from pipeline.io import ColumnError, pick, read_csv_rows, write_csv


def test_read_csv_rows_handles_cp949(tmp_path: Path):
    p = tmp_path / "a.csv"
    p.write_bytes("호선,역명\n2호선,홍대입구\n".encode("cp949"))
    assert read_csv_rows(p) == [{"호선": "2호선", "역명": "홍대입구"}]


def test_read_csv_rows_handles_utf8_bom(tmp_path: Path):
    p = tmp_path / "a.csv"
    p.write_bytes("\ufeff호선,역명\n2호선,홍대입구\n".encode("utf-8"))
    assert read_csv_rows(p) == [{"호선": "2호선", "역명": "홍대입구"}]


def test_pick_uses_first_present_alias():
    row = {"역간거리(km)": "1.2"}
    assert pick(row, ("역간거리", "역간거리(km)")) == "1.2"


def test_pick_raises_with_header_listing():
    with pytest.raises(ColumnError) as exc:
        pick({"a": "1", "b": "2"}, ("역명",))
    assert "역명" in str(exc.value) and "a" in str(exc.value)


def test_pick_optional_returns_empty():
    assert pick({"a": "1"}, ("역명",), required=False) == ""


def test_write_csv_round_trip(tmp_path: Path):
    p = tmp_path / "o.csv"
    write_csv(p, ["id", "name"], [{"id": 1, "name": "홍대입구"}])
    assert read_csv_rows(p) == [{"id": "1", "name": "홍대입구"}]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("2호선", "2호선"),
        ("서울 2호선", "2호선"),
        ("수도권 9호선", "9호선"),
        ("경의중앙선", "경의중앙선"),
        ("수인분당선", "수인분당선"),
        ("분당선", "수인분당선"),
        ("GTX-A", "GTX-A"),
        ("부산 1호선", None),
    ],
)
def test_canonical_line(raw, expected):
    assert canonical_line(raw) == expected
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/pipeline -v`
Expected: FAIL, `No module named 'pipeline'`

- [ ] **Step 4: config.py 작성**

`backend/pipeline/__init__.py`: 빈 파일.

`backend/pipeline/config.py`:
```python
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
MANUAL_DIR = DATA_DIR / "manual"
OUT_DIR = DATA_DIR / "out"

METRO_LAT_RANGE = (36.9, 38.3)
METRO_LNG_RANGE = (126.3, 127.9)

GROUP_RADIUS_KM = 0.5
DEFAULT_TRANSFER_MIN = 4.0
DWELL_MIN = 0.5
HAVERSINE_DETOUR = 1.15
SPEED_KMH = {"urban": 32.0, "regional": 45.0, "gtx": 80.0}
MAX_EDGE_KM = {"urban": 5.0, "regional": 12.0, "gtx": 25.0}
LINE_CLASSES = tuple(SPEED_KMH)


@dataclass(frozen=True)
class RawFile:
    filename: str
    url: str
    note: str = ""


RAW_FILES: dict[str, RawFile] = {
    "stations_std": RawFile(
        "전국도시철도역사정보표준데이터.xlsx",
        "https://www.data.go.kr/data/15013205/standard.do",
        "국가철도공단 표준데이터, XLSX 다운로드",
    ),
    "seoul_times": RawFile(
        "서울교통공사_역간거리_및_소요시간.csv",
        "https://data.seoul.go.kr/dataList/OA-12034/S/1/datasetView.do",
        "1~8호선 역 순서, 거리(km), 운행시간(분)",
    ),
    "transfers": RawFile(
        "서울교통공사_환승역거리_소요시간정보.csv",
        "https://www.data.go.kr/data/15044419/fileData.do",
        "환승역 145곳 환승소요시간",
    ),
}
# 국가철도공단 노선별 역간거리 파일은 여러 개라 글롭으로 잡는다.
KRAIL_DISTANCE_GLOB = "국가철도공단_*역간거리*.csv"

# 표준 노선명 -> 원본 파일들에 등장하는 표기. 원본 헤더를 확인하면서(Task 3) 늘린다.
LINE_ALIASES: dict[str, tuple[str, ...]] = {
    "1호선": ("1호선", "서울 1호선", "수도권1호선", "수도권 1호선", "경부선", "경인선", "경원선", "장항선"),
    "2호선": ("2호선", "서울 2호선"),
    "3호선": ("3호선", "서울 3호선", "일산선"),
    "4호선": ("4호선", "서울 4호선", "안산선", "과천선", "진접선"),
    "5호선": ("5호선", "서울 5호선", "수도권5호선", "수도권 5호선", "하남선"),
    "6호선": ("6호선", "서울 6호선"),
    "7호선": ("7호선", "서울 7호선", "수도권7호선", "수도권 7호선"),
    "8호선": ("8호선", "서울 8호선", "별내선"),
    "9호선": ("9호선", "서울 9호선", "수도권9호선", "수도권 9호선"),
    "경의중앙선": ("경의중앙선", "경의선", "중앙선", "경의.중앙선"),
    "수인분당선": ("수인분당선", "분당선", "수인선", "수인.분당선"),
    "경춘선": ("경춘선",),
    "경강선": ("경강선",),
    "서해선": ("서해선", "대곡소사선"),
    "공항철도": ("공항철도", "인천국제공항철도", "인천공항철도", "공항철도선"),
    "신분당선": ("신분당선",),
    "우이신설선": ("우이신설선", "우이신설경전철"),
    "신림선": ("신림선",),
    "김포골드라인": ("김포골드라인", "김포도시철도"),
    "의정부경전철": ("의정부경전철", "의정부선"),
    "용인에버라인": ("용인에버라인", "에버라인", "용인경전철"),
    "인천1호선": ("인천1호선", "인천 1호선"),
    "인천2호선": ("인천2호선", "인천 2호선"),
    "GTX-A": ("GTX-A", "GTX A", "수도권광역급행철도 A", "GTX-A선"),
}
_ALIAS_INDEX = {alias.replace(" ", ""): canon for canon, aliases in LINE_ALIASES.items() for alias in aliases}


def canonical_line(raw: str) -> str | None:
    return _ALIAS_INDEX.get(raw.strip().replace(" ", ""))


# 원본별 컬럼 별칭. 포털 설명 기준이며 Task 3에서 실제 헤더로 확정한다.
COLUMNS: dict[str, dict[str, tuple[str, ...]]] = {
    "std": {
        "name": ("역사명",),
        "line": ("노선명",),
        "operator": ("운영기관명",),
        "lat": ("위도",),
        "lng": ("경도",),
        "address": ("도로명주소", "역사도로명주소"),
    },
    "seoul": {
        "line": ("호선",),
        "name": ("역명",),
        "minutes": ("운행시간(분)", "운행시간", "소요시간(분)", "소요시간"),
        "km": ("역간거리(km)", "역간거리"),
    },
    "krail": {
        "operator": ("철도운영기관명",),
        "line": ("선명", "노선명"),
        "name": ("역명",),
        "km": ("역간거리", "역간거리(km)"),
    },
    "transfer": {
        "line": ("호선",),
        "name": ("환승역명",),
        "to_line": ("환승노선",),
        "minutes": ("환승소요시간", "환승소요시간(분)"),
    },
}
```

- [ ] **Step 5: io.py 작성**

`backend/pipeline/io.py`:
```python
import csv
import sys
from collections.abc import Iterable, Sequence
from pathlib import Path

from openpyxl import load_workbook

from pipeline.config import RAW_DIR, RAW_FILES

ENCODINGS = ("utf-8-sig", "cp949", "euc-kr")


class ColumnError(Exception):
    pass


def _clean_header(fields: Iterable[str | None]) -> list[str]:
    return [(f or "").strip().replace("\ufeff", "") for f in fields]


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    last: Exception | None = None
    for enc in ENCODINGS:
        try:
            with path.open(encoding=enc, newline="") as f:
                reader = csv.reader(f)
                header = _clean_header(next(reader))
                return [dict(zip(header, [c.strip() for c in row])) for row in reader if any(row)]
        except UnicodeDecodeError as exc:
            last = exc
    raise UnicodeDecodeError("csv", b"", 0, 0, f"{path}: {last}")


def read_xlsx_rows(path: Path) -> list[dict[str, str]]:
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = _clean_header(next(rows))
    out = []
    for row in rows:
        if row is None or all(v in (None, "") for v in row):
            continue
        out.append({h: ("" if v is None else str(v).strip()) for h, v in zip(header, row)})
    wb.close()
    return out


def pick(row: dict[str, str], aliases: Sequence[str], required: bool = True) -> str:
    for a in aliases:
        if a in row:
            return row[a]
    if required:
        raise ColumnError(f"컬럼 {list(aliases)} 없음. 실제 헤더: {list(row)}")
    return ""


def write_csv(path: Path, fieldnames: Sequence[str], rows: Iterable[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(fieldnames))
        writer.writeheader()
        for r in rows:
            writer.writerow(r)


def require_raw(key: str) -> Path:
    spec = RAW_FILES[key]
    path = RAW_DIR / spec.filename
    if not path.exists():
        print(f"원본 파일 없음: {path}", file=sys.stderr)
        print(f"  다운로드: {spec.url}", file=sys.stderr)
        print(f"  저장 위치: {path}", file=sys.stderr)
        sys.exit(2)
    return path
```

- [ ] **Step 6: names.py 작성**

`backend/pipeline/names.py`:
```python
import re

_PAREN = re.compile(r"\([^)]*\)|（[^）]*）")
_SPACES = re.compile(r"[\s\u3000]+")


def normalize_station_name(raw: str) -> str:
    """괄호와 내용 제거, 공백 제거, 끝의 '역' 제거. 원문은 호출자가 따로 보존한다."""
    s = _PAREN.sub("", raw)
    s = _SPACES.sub("", s)
    if len(s) > 1 and s.endswith("역"):
        s = s[:-1]
    return s
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/pipeline -v`
Expected: 전부 PASS

- [ ] **Step 8: 커밋**

```bash
git add pyproject.toml pipeline tests/pipeline
git commit -m "feat: pipeline skeleton with config, io helpers and name normalization"
```

---

### Task 3: 원본 파일 확보와 헤더 확인

이 태스크는 외부 사이트에서 파일을 받는 일이라 실행자가 다운로드를 못 하면 사용자에게 요청해야 한다. 코드 산출물은 `pipeline/inspect.py`와 `data/SOURCES.md`, 그리고 확인된 헤더에 맞춘 `config.py` 별칭 수정이다.

**Files:**
- Create: `backend/pipeline/inspect.py`
- Create: `backend/data/SOURCES.md`
- Create: `backend/data/raw/` (원본 파일들)
- Modify: `backend/pipeline/config.py` (실제 헤더와 노선명에 맞게 COLUMNS, LINE_ALIASES 보정)
- Test: `backend/tests/pipeline/test_inspect.py`

**Interfaces:**
- Consumes: `read_csv_rows`, `read_xlsx_rows`, `RAW_FILES`, `KRAIL_DISTANCE_GLOB`, `COLUMNS`
- Produces: `inspect_file(path) -> tuple[list[str], list[dict]]` (헤더, 앞 3행), `missing_columns(header, aliases_by_field) -> list[str]`, CLI `python -m pipeline.inspect`가 raw의 모든 파일에 대해 헤더와 샘플, 누락 컬럼을 출력.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/pipeline/test_inspect.py`:
```python
from pathlib import Path

from pipeline.inspect import inspect_file, missing_columns


def test_inspect_csv_returns_header_and_samples(tmp_path: Path):
    p = tmp_path / "x.csv"
    p.write_text("호선,역명\n2호선,홍대입구\n2호선,신촌\n", encoding="utf-8")
    header, samples = inspect_file(p)
    assert header == ["호선", "역명"]
    assert samples[0]["역명"] == "홍대입구"


def test_missing_columns_lists_fields_without_any_alias():
    aliases = {"name": ("역명",), "km": ("역간거리", "역간거리(km)")}
    assert missing_columns(["역명", "선명"], aliases) == ["km"]
    assert missing_columns(["역명", "역간거리(km)"], aliases) == []
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_inspect.py -v`
Expected: FAIL, `No module named 'pipeline.inspect'`

- [ ] **Step 3: inspect.py 작성**

`backend/pipeline/inspect.py`:
```python
"""raw 폴더의 원본 파일 헤더와 샘플 행을 출력하고, config.COLUMNS와 맞지 않는 컬럼을 알려준다.

실행: python -m pipeline.inspect
"""

from pathlib import Path

from pipeline.config import COLUMNS, KRAIL_DISTANCE_GLOB, RAW_DIR, RAW_FILES
from pipeline.io import read_csv_rows, read_xlsx_rows


def inspect_file(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    rows = read_xlsx_rows(path) if path.suffix.lower() in (".xlsx", ".xlsm") else read_csv_rows(path)
    header = list(rows[0]) if rows else []
    return header, rows[:3]


def missing_columns(header: list[str], aliases_by_field: dict[str, tuple[str, ...]]) -> list[str]:
    return [field for field, aliases in aliases_by_field.items() if not any(a in header for a in aliases)]


def _report(path: Path, schema: str) -> None:
    header, samples = inspect_file(path)
    print(f"\n== {path.name} ({len(header)} columns)")
    print("header:", header)
    for s in samples:
        print("row:", s)
    missing = missing_columns(header, COLUMNS[schema])
    print("missing for", schema, ":", missing or "none")


def main() -> None:
    schema_by_key = {"stations_std": "std", "seoul_times": "seoul", "transfers": "transfer"}
    for key, spec in RAW_FILES.items():
        path = RAW_DIR / spec.filename
        if path.exists():
            _report(path, schema_by_key[key])
        else:
            print(f"\n== {spec.filename}: 없음. 다운로드 {spec.url}")
    for path in sorted(RAW_DIR.glob(KRAIL_DISTANCE_GLOB)):
        _report(path, "krail")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_inspect.py -v`
Expected: 2 PASS

- [ ] **Step 5: 원본 파일 다운로드**

브라우저 또는 curl로 다음을 받아 `backend/data/raw/`에 `config.RAW_FILES`의 파일명으로 저장한다. 국가철도공단 역간거리 파일은 원래 파일명 앞에 `국가철도공단_`이 붙어 있으면 그대로, 아니면 `국가철도공단_<노선>_역간거리.csv`로 저장한다.

| 파일 | URL |
|---|---|
| 전국도시철도역사정보표준데이터.xlsx | https://www.data.go.kr/data/15013205/standard.do (파일 다운로드 버튼) |
| 서울교통공사_역간거리_및_소요시간.csv | https://data.seoul.go.kr/dataList/OA-12034/S/1/datasetView.do |
| 서울교통공사_환승역거리_소요시간정보.csv | https://www.data.go.kr/data/15044419/fileData.do |
| 국가철도공단 역간거리: 9호선, 경강선, 인천교통공사, 인천2호선, 공항철도, 에버라인, 수도권1호선, 코레일, 수도권5호선 | data.go.kr 15041298, 15041296, 15081857, 15081856, 15041310, 15081850, 15041460, 15081858, 15041348 |
| 국가철도공단 역간거리: 신분당선, 경의중앙선, 수인분당선(또는 수인선, 분당선), 경춘선 | data.go.kr에서 "국가철도공단 <노선명> 역간거리" 검색 |

로그인이 필요해 실행자가 받을 수 없으면 BLOCKED로 보고하고 사용자에게 위 표를 전달한다.

- [ ] **Step 6: 헤더 확인과 config 보정**

Run: `.venv/Scripts/python -m pipeline.inspect`

출력에서 `missing for ... : none`이 아닌 파일이 있으면 실제 헤더 이름을 `config.COLUMNS`의 별칭에 추가한다. 표준데이터의 노선명 값 목록도 확인한다:
```bash
.venv/Scripts/python -c "from pipeline.io import read_xlsx_rows; from pipeline.config import RAW_DIR, RAW_FILES; rows=read_xlsx_rows(RAW_DIR/RAW_FILES['stations_std'].filename); import collections; print(collections.Counter(r.get('노선명','') for r in rows).most_common())"
```
수도권 노선인데 `canonical_line`이 None을 돌려주는 표기가 있으면 `LINE_ALIASES`에 추가한다. 경전철 5개 노선(우이신설, 신림, 김포골드, 의정부, 용인)이 파일에 없으면 그 사실을 `SOURCES.md`에 적고 Task 8에서 좌표를 manual 파일로 보충한다.

- [ ] **Step 7: SOURCES.md 작성**

`backend/data/SOURCES.md`:
```markdown
# 원본 데이터 출처

받은 날짜와 파일을 기록한다. 갱신할 때는 같은 파일명으로 덮어쓰고 날짜를 고친다.

| 파일 | 출처 | 제공 | 라이선스 | 받은 날짜 |
|---|---|---|---|---|
| 전국도시철도역사정보표준데이터.xlsx | https://www.data.go.kr/data/15013205/standard.do | 국가철도공단 | 이용허락범위 제한 없음 | (날짜) |
| 서울교통공사_역간거리_및_소요시간.csv | https://data.seoul.go.kr/dataList/OA-12034/S/1/datasetView.do | 서울교통공사 | 공공누리 1유형 | (날짜) |
| 서울교통공사_환승역거리_소요시간정보.csv | https://www.data.go.kr/data/15044419/fileData.do | 서울교통공사 | 이용허락범위 제한 없음 | (날짜) |
| 국가철도공단_*_역간거리.csv (노선별) | data.go.kr 국가철도공단 역간거리 시리즈 | 국가철도공단 | 이용허락범위 제한 없음 | (날짜) |

출처 표시 문구: "본 서비스는 국가철도공단, 서울교통공사가 제공한 공공데이터를 이용합니다."

## 확인된 사실

- (Task 3에서 inspect 결과를 여기 적는다: 실제 헤더, 노선명 표기, 경전철 포함 여부, 공항철도 소요시간 컬럼 유무)
```
`(날짜)`를 실제 날짜로, "확인된 사실"을 inspect 결과로 채운다.

- [ ] **Step 8: 커밋**

```bash
git add pipeline/inspect.py pipeline/config.py data/SOURCES.md data/raw tests/pipeline/test_inspect.py
git commit -m "feat: add raw data files, source registry and header inspector"
```

---

### Task 4: stations 단계

**Files:**
- Create: `backend/pipeline/stations.py`
- Create: `backend/tests/pipeline/fixtures/std_stations.xlsx` (테스트에서 openpyxl로 생성해도 됨. 아래는 생성 코드)
- Test: `backend/tests/pipeline/test_stations.py`

**Interfaces:**
- Consumes: `read_xlsx_rows`, `pick`, `COLUMNS["std"]`, `canonical_line`, `METRO_*_RANGE`, `normalize_station_name`
- Produces: `StationRow(id, name, raw_name, line, operator, lat, lng, region)` frozen dataclass; `parse_standard(rows) -> list[StationRow]`; `region_from_address(address) -> str`; `STATION_FIELDS` 튜플; `main()`이 `out/stations.csv`를 씀 (group_id 컬럼은 빈 값).

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/pipeline/test_stations.py`:
```python
import pytest

from pipeline.stations import StationRow, parse_standard, region_from_address

ROWS = [
    {"역사명": "홍대입구", "노선명": "2호선", "운영기관명": "서울교통공사", "위도": "37.5571", "경도": "126.9245", "도로명주소": "서울특별시 마포구 양화로 지하 160"},
    {"역사명": "홍대입구", "노선명": "경의중앙선", "운영기관명": "한국철도공사", "위도": "37.5578", "경도": "126.9255", "도로명주소": "서울특별시 마포구 양화로 지하 188"},
    {"역사명": "수원", "노선명": "경부선", "운영기관명": "한국철도공사", "위도": "37.2660", "경도": "126.9999", "도로명주소": "경기도 수원시 팔달구 덕영대로 924"},
    {"역사명": "서면", "노선명": "부산 1호선", "운영기관명": "부산교통공사", "위도": "35.1579", "경도": "129.0594", "도로명주소": "부산광역시 부산진구 중앙대로 지하 730"},
    {"역사명": "천안", "노선명": "1호선", "운영기관명": "한국철도공사", "위도": "36.8100", "경도": "127.1469", "도로명주소": "충청남도 천안시 동남구 대흥로 239"},
]


def test_parse_keeps_metro_rows_and_maps_lines():
    rows = parse_standard(ROWS)
    assert [(r.name, r.line) for r in rows] == [
        ("홍대입구", "2호선"),
        ("홍대입구", "경의중앙선"),
        ("수원", "1호선"),
    ]


def test_parse_assigns_sequential_ids_and_regions():
    rows = parse_standard(ROWS)
    assert [r.id for r in rows] == [1, 2, 3]
    assert [r.region for r in rows] == ["서울", "서울", "경기"]
    assert rows[0] == StationRow(1, "홍대입구", "홍대입구", "2호선", "서울교통공사", 37.5571, 126.9245, "서울")


def test_parse_rejects_duplicate_name_and_line():
    dup = ROWS[:1] + [dict(ROWS[0], 위도="37.5572")]
    with pytest.raises(ValueError, match="중복"):
        parse_standard(dup)


def test_parse_normalizes_name_but_keeps_raw():
    rows = parse_standard([dict(ROWS[0], 역사명="총신대입구(이수)")])
    assert rows[0].name == "총신대입구"
    assert rows[0].raw_name == "총신대입구(이수)"


@pytest.mark.parametrize(
    ("address", "expected"),
    [("서울특별시 마포구", "서울"), ("경기도 수원시", "경기"), ("인천광역시 부평구", "인천"), ("", ""), ("충청남도 천안시", "")],
)
def test_region_from_address(address, expected):
    assert region_from_address(address) == expected
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_stations.py -v`
Expected: FAIL, `No module named 'pipeline.stations'`

- [ ] **Step 3: stations.py 작성**

`backend/pipeline/stations.py`:
```python
"""표준데이터 XLSX에서 수도권 역 노드를 뽑아 out/stations.csv를 만든다.

실행: python -m pipeline.stations
"""

from dataclasses import asdict, dataclass

from pipeline.config import COLUMNS, METRO_LAT_RANGE, METRO_LNG_RANGE, OUT_DIR, canonical_line
from pipeline.io import pick, read_xlsx_rows, require_raw, write_csv
from pipeline.names import normalize_station_name

STATION_FIELDS = ("id", "name", "raw_name", "line", "operator", "lat", "lng", "region", "group_id")
_REGION_PREFIX = {"서울": "서울", "경기": "경기", "인천": "인천"}


@dataclass(frozen=True)
class StationRow:
    id: int
    name: str
    raw_name: str
    line: str
    operator: str
    lat: float
    lng: float
    region: str


def region_from_address(address: str) -> str:
    return _REGION_PREFIX.get(address.strip()[:2], "")


def _in_metro(lat: float, lng: float) -> bool:
    return METRO_LAT_RANGE[0] <= lat <= METRO_LAT_RANGE[1] and METRO_LNG_RANGE[0] <= lng <= METRO_LNG_RANGE[1]


def parse_standard(rows: list[dict[str, str]]) -> list[StationRow]:
    cols = COLUMNS["std"]
    out: list[StationRow] = []
    seen: set[tuple[str, str]] = set()
    for row in rows:
        line = canonical_line(pick(row, cols["line"]))
        if line is None:
            continue
        try:
            lat, lng = float(pick(row, cols["lat"])), float(pick(row, cols["lng"]))
        except ValueError:
            continue
        if not _in_metro(lat, lng):
            continue
        raw_name = pick(row, cols["name"])
        name = normalize_station_name(raw_name)
        key = (name, line)
        if key in seen:
            raise ValueError(f"중복 역: {key}")
        seen.add(key)
        out.append(
            StationRow(
                id=len(out) + 1,
                name=name,
                raw_name=raw_name,
                line=line,
                operator=pick(row, cols["operator"], required=False),
                lat=lat,
                lng=lng,
                region=region_from_address(pick(row, cols["address"], required=False)),
            )
        )
    return out


def main() -> None:
    rows = read_xlsx_rows(require_raw("stations_std"))
    stations = parse_standard(rows)
    write_csv(OUT_DIR / "stations.csv", STATION_FIELDS, [{**asdict(s), "group_id": ""} for s in stations])
    print(f"stations: {len(stations)} rows -> {OUT_DIR / 'stations.csv'}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_stations.py -v`
Expected: 6 PASS

- [ ] **Step 5: 실제 파일로 실행**

Run: `.venv/Scripts/python -m pipeline.stations`
Expected: `stations: N rows` (N은 600~800 사이여야 정상. 그 밖이면 LINE_ALIASES나 경계값을 의심하고 노선별 개수를 출력해 확인)

- [ ] **Step 6: 커밋**

```bash
git add pipeline/stations.py tests/pipeline/test_stations.py data/out/stations.csv
git commit -m "feat: build station nodes from standard station dataset"
```

---

### Task 5: 시간 추정

**Files:**
- Create: `backend/pipeline/estimate.py`
- Test: `backend/tests/pipeline/test_estimate.py`

**Interfaces:**
- Consumes: `SPEED_KMH`, `DWELL_MIN`
- Produces: `estimate_minutes(km: float, line_class: str) -> float`, `calibrate_speed(pairs: list[tuple[float, float]]) -> float` (km, 실측분 쌍에서 최소제곱 속도 km/h), CLI `python -m pipeline.estimate --calibrate`가 1~8호선 실측으로 urban 속도를 출력.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/pipeline/test_estimate.py`:
```python
import pytest

from pipeline.estimate import calibrate_speed, estimate_minutes


def test_urban_two_km_is_about_four_minutes():
    # 2 / 32 * 60 + 0.5 = 4.25 -> 4.2 (소수 1자리 반올림)
    assert estimate_minutes(2.0, "urban") == pytest.approx(4.2, abs=0.05)


def test_regional_is_faster_per_km():
    assert estimate_minutes(10.0, "regional") < estimate_minutes(10.0, "urban")


def test_gtx_is_fastest():
    assert estimate_minutes(20.0, "gtx") < estimate_minutes(20.0, "regional")


def test_minimum_is_one_minute():
    assert estimate_minutes(0.1, "urban") == 1.0


def test_unknown_class_raises():
    with pytest.raises(KeyError):
        estimate_minutes(1.0, "tram")


def test_calibrate_recovers_speed():
    speed = 30.0
    pairs = [(km, km / speed * 60 + 0.5) for km in (0.8, 1.2, 1.5, 2.0, 3.1)]
    assert calibrate_speed(pairs) == pytest.approx(30.0, rel=1e-6)


def test_calibrate_ignores_zero_km():
    assert calibrate_speed([(0.0, 0.0), (2.0, 4.5)]) == pytest.approx(30.0, rel=1e-6)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_estimate.py -v`
Expected: FAIL, `No module named 'pipeline.estimate'`

- [ ] **Step 3: estimate.py 작성**

`backend/pipeline/estimate.py`:
```python
"""역간 거리(km)로 소요시간(분)을 추정한다. 실측이 있는 1~8호선으로 도시철도 속도를 보정할 수 있다.

실행: python -m pipeline.estimate --calibrate
"""

import sys

from pipeline.config import COLUMNS, DWELL_MIN, SPEED_KMH
from pipeline.io import pick, read_csv_rows, require_raw


def estimate_minutes(km: float, line_class: str) -> float:
    speed = SPEED_KMH[line_class]
    return max(1.0, round(km / speed * 60 + DWELL_MIN, 1))


def calibrate_speed(pairs: list[tuple[float, float]]) -> float:
    """(km, 분) 쌍에서 원점을 지나는 최소제곱: 분 - 정차 = km * (60 / 속도)."""
    usable = [(km, m) for km, m in pairs if km > 0 and m > DWELL_MIN]
    sxx = sum(km * km for km, _ in usable)
    sxy = sum(km * (m - DWELL_MIN) for km, m in usable)
    slope = sxy / sxx
    return 60.0 / slope


def _measured_pairs() -> list[tuple[float, float]]:
    cols = COLUMNS["seoul"]
    pairs = []
    for row in read_csv_rows(require_raw("seoul_times")):
        try:
            km = float(pick(row, cols["km"]) or 0)
            minutes = float(pick(row, cols["minutes"]) or 0)
        except ValueError:
            continue
        pairs.append((km, minutes))
    return pairs


if __name__ == "__main__":
    if "--calibrate" in sys.argv:
        speed = calibrate_speed(_measured_pairs())
        print(f"1~8호선 실측 기준 urban 속도: {speed:.1f} km/h (config: {SPEED_KMH['urban']})")
        gap = abs(speed - SPEED_KMH["urban"]) / SPEED_KMH["urban"]
        print("15% 넘게 차이" if gap > 0.15 else "15% 이내, 상수 유지")
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_estimate.py -v`
Expected: 7 PASS

- [ ] **Step 5: 보정 실행과 기록**

Run: `.venv/Scripts/python -m pipeline.estimate --calibrate`
15% 넘게 차이 나면 `config.SPEED_KMH["urban"]`을 출력값(소수 첫째 자리 반올림)으로 바꾸고 `data/SOURCES.md` "확인된 사실"에 "urban 속도 보정: X km/h (날짜)"를 적는다. 이내면 그대로 두고 값만 적는다. 서울교통공사 파일의 운행시간이 "분:초" 형식이면 `_measured_pairs`에서 `"1:30"`을 1.5로 바꾸는 파싱을 추가하고 테스트도 추가한다.

- [ ] **Step 6: 커밋**

```bash
git add pipeline/estimate.py pipeline/config.py data/SOURCES.md tests/pipeline/test_estimate.py
git commit -m "feat: distance based travel time estimate with calibration"
```

---

### Task 6: edges 단계 (파서 3종과 간선 생성)

**Files:**
- Create: `backend/pipeline/edges.py`
- Create: `backend/data/manual/line_classes.csv`
- Create: `backend/data/manual/station_aliases.csv`
- Test: `backend/tests/pipeline/test_edges.py`

**Interfaces:**
- Consumes: `StationRow` (Task 4), `estimate_minutes` (Task 5), `haversine_km` (`app.geo`), `HAVERSINE_DETOUR`, `COLUMNS`, `canonical_line`, `normalize_station_name`, `read_csv_rows`, `pick`
- Produces: `Edge(from_id, to_id, line, km, minutes, source)` frozen dataclass; `Segment = list[tuple[str, float | None, float | None]]` (역명, km_from_prev, minutes_from_prev); `parse_seoul_segments(rows) -> dict[str, list[Segment]]`; `parse_krail_segments(rows) -> dict[str, list[Segment]]`; `parse_manual_segments(rows) -> dict[str, list[Segment]]`; `MatchError(Exception)` with `.unmatched: list[tuple[str, str]]`; `StationIndex` (이름과 별칭으로 (name, line) -> StationRow 조회); `build_edges(segments_by_line, index, classes) -> list[Edge]`; `load_line_classes(path) -> dict[str, str]`; `load_aliases(path) -> dict[str, str]`; `EDGE_FIELDS`; `main()`이 `out/edges.csv`를 씀.

- [ ] **Step 1: manual 파일 작성**

`backend/data/manual/line_classes.csv`:
```csv
line,line_class
1호선,urban
2호선,urban
3호선,urban
4호선,urban
5호선,urban
6호선,urban
7호선,urban
8호선,urban
9호선,urban
인천1호선,urban
인천2호선,urban
우이신설선,urban
신림선,urban
김포골드라인,urban
의정부경전철,urban
용인에버라인,urban
경의중앙선,regional
수인분당선,regional
경춘선,regional
경강선,regional
서해선,regional
공항철도,regional
신분당선,regional
GTX-A,gtx
```

`backend/data/manual/station_aliases.csv` (정규화된 이름 기준. a와 b를 같은 이름으로 취급):
```csv
a,b
총신대입구,이수
```

- [ ] **Step 2: 실패하는 테스트 작성**

`backend/tests/pipeline/test_edges.py`:
```python
import pytest

from pipeline.edges import (
    Edge,
    MatchError,
    StationIndex,
    build_edges,
    parse_krail_segments,
    parse_manual_segments,
    parse_seoul_segments,
)
from pipeline.stations import StationRow

S = [
    StationRow(1, "시청", "시청", "2호선", "서울교통공사", 37.5657, 126.9769, "서울"),
    StationRow(2, "을지로입구", "을지로입구", "2호선", "서울교통공사", 37.5660, 126.9827, "서울"),
    StationRow(3, "을지로3가", "을지로3가", "2호선", "서울교통공사", 37.5663, 126.9917, "서울"),
    StationRow(4, "성수", "성수", "2호선", "서울교통공사", 37.5445, 127.0560, "서울"),
    StationRow(5, "용답", "용답", "2호선", "서울교통공사", 37.5617, 127.0513, "서울"),
    StationRow(6, "판교", "판교", "경강선", "한국철도공사", 37.3947, 127.1112, "경기"),
    StationRow(7, "이매", "이매", "경강선", "한국철도공사", 37.3960, 127.1282, "경기"),
    StationRow(8, "북한산우이", "북한산우이", "우이신설선", "우이신설경전철", 37.6631, 127.0124, "서울"),
    StationRow(9, "솔밭공원", "솔밭공원", "우이신설선", "우이신설경전철", 37.6560, 127.0132, "서울"),
]
CLASSES = {"2호선": "urban", "경강선": "regional", "우이신설선": "urban"}


def test_parse_seoul_splits_segments_at_zero_minutes():
    rows = [
        {"호선": "2호선", "역명": "시청", "운행시간(분)": "0", "역간거리(km)": "0"},
        {"호선": "2호선", "역명": "을지로입구", "운행시간(분)": "2", "역간거리(km)": "0.7"},
        {"호선": "2호선", "역명": "을지로3가", "운행시간(분)": "2", "역간거리(km)": "0.8"},
        {"호선": "2호선", "역명": "성수", "운행시간(분)": "0", "역간거리(km)": "0"},
        {"호선": "2호선", "역명": "용답", "운행시간(분)": "2", "역간거리(km)": "2.3"},
    ]
    segs = parse_seoul_segments(rows)
    assert list(segs) == ["2호선"]
    assert [[name for name, _, _ in seg] for seg in segs["2호선"]] == [
        ["시청", "을지로입구", "을지로3가"],
        ["성수", "용답"],
    ]
    assert segs["2호선"][0][1] == ("을지로입구", 0.7, 2.0)


def test_parse_krail_uses_distance_only():
    rows = [
        {"철도운영기관명": "한국철도공사", "선명": "경강선", "역명": "판교", "역간거리": "0", "후행역간거리": "1.8"},
        {"철도운영기관명": "한국철도공사", "선명": "경강선", "역명": "이매", "역간거리": "1.8", "후행역간거리": ""},
    ]
    segs = parse_krail_segments(rows)
    assert segs["경강선"] == [[("판교", None, None), ("이매", 1.8, None)]]


def test_parse_manual_orders_by_seq():
    rows = [
        {"line": "우이신설선", "seq": "2", "name": "솔밭공원"},
        {"line": "우이신설선", "seq": "1", "name": "북한산우이"},
    ]
    segs = parse_manual_segments(rows)
    assert segs["우이신설선"] == [[("북한산우이", None, None), ("솔밭공원", None, None)]]


def test_build_edges_measured_and_estimated():
    index = StationIndex(S, aliases={})
    segs = {
        "2호선": [[("시청", None, None), ("을지로입구", 0.7, 2.0)]],
        "경강선": [[("판교", None, None), ("이매", 1.8, None)]],
        "우이신설선": [[("북한산우이", None, None), ("솔밭공원", None, None)]],
    }
    edges = build_edges(segs, index, CLASSES)
    by_pair = {(e.from_id, e.to_id): e for e in edges}
    assert by_pair[(1, 2)] == Edge(1, 2, "2호선", 0.7, 2.0, "measured")
    e_regional = by_pair[(6, 7)]
    assert e_regional.source == "estimated" and e_regional.km == 1.8 and e_regional.minutes == pytest.approx(2.9, abs=0.05)
    e_manual = by_pair[(8, 9)]
    assert e_manual.source == "estimated" and 0.8 < e_manual.km < 1.0  # 직선 0.79km x 1.15


def test_build_edges_reports_all_unmatched_names():
    index = StationIndex(S, aliases={})
    segs = {"2호선": [[("시청", None, None), ("없는역", 1.0, 2.0), ("또없는역", 1.0, 2.0)]]}
    with pytest.raises(MatchError) as exc:
        build_edges(segs, index, CLASSES)
    assert exc.value.unmatched == [("2호선", "없는역"), ("2호선", "또없는역")]


def test_station_index_resolves_alias():
    rows = S + [StationRow(10, "이수", "이수", "7호선", "서울교통공사", 37.4857, 126.9820, "서울")]
    index = StationIndex(rows, aliases={"총신대입구": "이수"})
    assert index.get("총신대입구", "7호선").id == 10
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_edges.py -v`
Expected: FAIL, `No module named 'pipeline.edges'`

- [ ] **Step 4: edges.py 작성**

`backend/pipeline/edges.py`:
```python
"""노선별 역 순서 파일 3종을 읽어 인접 간선(out/edges.csv)을 만든다.

실행: python -m pipeline.edges
"""

from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path

from app.geo import haversine_km
from pipeline.config import (
    COLUMNS,
    HAVERSINE_DETOUR,
    KRAIL_DISTANCE_GLOB,
    MANUAL_DIR,
    OUT_DIR,
    RAW_DIR,
    canonical_line,
)
from pipeline.estimate import estimate_minutes
from pipeline.io import pick, read_csv_rows, require_raw, write_csv
from pipeline.names import normalize_station_name
from pipeline.stations import StationRow

EDGE_FIELDS = ("from_id", "to_id", "line", "km", "minutes", "source")
Segment = list[tuple[str, float | None, float | None]]  # (역명, 직전 역까지 km, 직전 역까지 분)


@dataclass(frozen=True)
class Edge:
    from_id: int
    to_id: int
    line: str
    km: float
    minutes: float
    source: str  # measured 또는 estimated


class MatchError(Exception):
    def __init__(self, unmatched: list[tuple[str, str]]) -> None:
        self.unmatched = unmatched
        lines = "\n".join(f"  {line}: {name}" for line, name in unmatched)
        super().__init__(f"역명 매칭 실패 {len(unmatched)}건:\n{lines}")


class StationIndex:
    def __init__(self, stations: Sequence[StationRow], aliases: dict[str, str]) -> None:
        self._by_key = {(s.name, s.line): s for s in stations}
        self._alias = dict(aliases)

    def get(self, name: str, line: str) -> StationRow | None:
        norm = normalize_station_name(name)
        for candidate in (norm, self._alias.get(norm, norm)):
            hit = self._by_key.get((candidate, line))
            if hit is not None:
                return hit
        return None


def _to_float(value: str) -> float | None:
    value = value.strip()
    if not value:
        return None
    if ":" in value:  # 분:초 형식
        m, s = value.split(":", 1)
        return float(m) + float(s) / 60
    try:
        return float(value)
    except ValueError:
        return None


def _append(segments: dict[str, list[Segment]], line: str, name: str, km: float | None, minutes: float | None, new_segment: bool) -> None:
    segs = segments.setdefault(line, [])
    if new_segment or not segs:
        segs.append([(name, None, None)])
    else:
        segs[-1].append((name, km, minutes))


def parse_seoul_segments(rows: Iterable[dict[str, str]]) -> dict[str, list[Segment]]:
    cols = COLUMNS["seoul"]
    segments: dict[str, list[Segment]] = {}
    for row in rows:
        line = canonical_line(pick(row, cols["line"]))
        if line is None:
            continue
        km = _to_float(pick(row, cols["km"], required=False))
        minutes = _to_float(pick(row, cols["minutes"], required=False))
        starts = not minutes and not km
        _append(segments, line, pick(row, cols["name"]), km, minutes, starts)
    return segments


def parse_krail_segments(rows: Iterable[dict[str, str]]) -> dict[str, list[Segment]]:
    cols = COLUMNS["krail"]
    segments: dict[str, list[Segment]] = {}
    for row in rows:
        line = canonical_line(pick(row, cols["line"]))
        if line is None:
            continue
        km = _to_float(pick(row, cols["km"], required=False))
        _append(segments, line, pick(row, cols["name"]), km, None, not km)
    return segments


def parse_manual_segments(rows: Iterable[dict[str, str]]) -> dict[str, list[Segment]]:
    ordered = sorted(rows, key=lambda r: (r["line"], int(r["seq"])))
    segments: dict[str, list[Segment]] = {}
    for row in ordered:
        line = canonical_line(row["line"]) or row["line"]
        _append(segments, line, row["name"], None, None, False)
    return segments


def build_edges(
    segments_by_line: dict[str, list[Segment]], index: StationIndex, classes: dict[str, str]
) -> list[Edge]:
    edges: list[Edge] = []
    unmatched: list[tuple[str, str]] = []
    seen: set[tuple[int, int]] = set()
    for line, segments in segments_by_line.items():
        for segment in segments:
            resolved = []
            for name, km, minutes in segment:
                station = index.get(name, line)
                if station is None:
                    unmatched.append((line, name))
                resolved.append((station, km, minutes))
            if unmatched:
                continue
            for (prev, _, _), (cur, km, minutes) in zip(resolved, resolved[1:]):
                a, b = sorted((prev.id, cur.id))
                if (a, b) in seen:
                    continue
                seen.add((a, b))
                distance = km if km else round(haversine_km(prev.lat, prev.lng, cur.lat, cur.lng) * HAVERSINE_DETOUR, 2)
                if minutes:
                    edges.append(Edge(a, b, line, distance, round(minutes, 1), "measured"))
                else:
                    edges.append(Edge(a, b, line, distance, estimate_minutes(distance, classes[line]), "estimated"))
    if unmatched:
        raise MatchError(unmatched)
    return edges


def load_line_classes(path: Path) -> dict[str, str]:
    return {r["line"]: r["line_class"] for r in read_csv_rows(path)}


def load_aliases(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for r in read_csv_rows(path):
        out[r["a"]] = r["b"]
        out[r["b"]] = r["a"]
    return out


def load_stations(path: Path) -> list[StationRow]:
    return [
        StationRow(int(r["id"]), r["name"], r["raw_name"], r["line"], r["operator"], float(r["lat"]), float(r["lng"]), r["region"])
        for r in read_csv_rows(path)
    ]


def _merge(*parts: dict[str, list[Segment]]) -> dict[str, list[Segment]]:
    merged: dict[str, list[Segment]] = {}
    for part in parts:
        for line, segs in part.items():
            merged.setdefault(line, []).extend(segs)
    return merged


def main() -> None:
    stations = load_stations(OUT_DIR / "stations.csv")
    index = StationIndex(stations, load_aliases(MANUAL_DIR / "station_aliases.csv"))
    classes = load_line_classes(MANUAL_DIR / "line_classes.csv")
    seoul = parse_seoul_segments(read_csv_rows(require_raw("seoul_times")))
    krail_rows = [row for p in sorted(RAW_DIR.glob(KRAIL_DISTANCE_GLOB)) for row in read_csv_rows(p)]
    krail = parse_krail_segments(krail_rows)
    # 1~8호선은 서울교통공사 실측을 우선한다. 국가철도공단 파일의 같은 노선 구간은 뺀다.
    krail = {line: segs for line, segs in krail.items() if line not in seoul}
    manual = parse_manual_segments(read_csv_rows(MANUAL_DIR / "line_orders.csv"))
    edges = build_edges(_merge(seoul, krail, manual), index, classes)
    write_csv(OUT_DIR / "edges.csv", EDGE_FIELDS, [asdict(e) for e in edges])
    measured = sum(1 for e in edges if e.source == "measured")
    print(f"edges: {len(edges)} rows ({measured} measured) -> {OUT_DIR / 'edges.csv'}")


if __name__ == "__main__":
    main()
```

주의: 국가철도공단 파일에서 1호선 코레일 구간(경인선 등)은 서울교통공사 파일에 없으므로 `krail` 필터로 빠지면 안 된다. 실제 실행에서 1호선 역이 빠지면 필터를 "서울교통공사 파일이 이미 다루는 (line, 역 쌍)"만 제외하도록 좁힌다. 이 판단은 Task 9 실제 실행에서 한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_edges.py -v`
Expected: 6 PASS

- [ ] **Step 6: 커밋**

```bash
git add pipeline/edges.py data/manual/line_classes.csv data/manual/station_aliases.csv tests/pipeline/test_edges.py
git commit -m "feat: build adjacency edges from three sequence sources"
```

---

### Task 7: groups 단계 (역 그룹과 환승 간선)

**Files:**
- Create: `backend/pipeline/groups.py`
- Test: `backend/tests/pipeline/test_groups.py`

**Interfaces:**
- Consumes: `StationRow`, `load_stations`, `load_aliases` (Task 6), `haversine_km`, `GROUP_RADIUS_KM`, `DEFAULT_TRANSFER_MIN`, `COLUMNS["transfer"]`, `canonical_line`, `normalize_station_name`
- Produces: `assign_groups(stations, aliases, radius_km) -> dict[int, int]` (station_id -> group_id, 1부터); `GroupRow(id, name, lat, lng, node_count)`; `group_rows(stations, group_of) -> list[GroupRow]`; `Transfer(from_id, to_id, minutes, source)`; `parse_transfer_minutes(rows) -> dict[tuple[str, str, str], float]` 키 (정규화 역명, 노선, 환승노선); `build_transfers(stations, group_of, minutes_table) -> list[Transfer]`; `GROUP_FIELDS`, `TRANSFER_FIELDS`; `main()`이 `station_groups.csv`, `transfers.csv`를 쓰고 `stations.csv`의 group_id를 채움.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/pipeline/test_groups.py`:
```python
from pipeline.groups import (
    Transfer,
    assign_groups,
    build_transfers,
    group_rows,
    parse_transfer_minutes,
)
from pipeline.stations import StationRow

S = [
    StationRow(1, "신촌", "신촌", "2호선", "서울교통공사", 37.5551, 126.9368, "서울"),
    StationRow(2, "신촌", "신촌(경의중앙선)", "경의중앙선", "한국철도공사", 37.5599, 126.9426, "서울"),
    StationRow(3, "홍대입구", "홍대입구", "2호선", "서울교통공사", 37.5571, 126.9245, "서울"),
    StationRow(4, "홍대입구", "홍대입구", "경의중앙선", "한국철도공사", 37.5578, 126.9255, "서울"),
    StationRow(5, "홍대입구", "홍대입구", "공항철도", "공항철도", 37.5575, 126.9249, "서울"),
    StationRow(6, "총신대입구", "총신대입구(이수)", "4호선", "서울교통공사", 37.4863, 126.9820, "서울"),
    StationRow(7, "이수", "이수", "7호선", "서울교통공사", 37.4857, 126.9822, "서울"),
]


def test_same_name_far_apart_are_separate_groups():
    g = assign_groups(S, aliases={}, radius_km=0.5)
    assert g[1] != g[2]


def test_same_name_close_together_share_a_group():
    g = assign_groups(S, aliases={}, radius_km=0.5)
    assert g[3] == g[4] == g[5]


def test_alias_joins_different_names():
    g = assign_groups(S, aliases={"총신대입구": "이수", "이수": "총신대입구"}, radius_km=0.5)
    assert g[6] == g[7]


def test_group_ids_are_dense_from_one():
    g = assign_groups(S, aliases={"총신대입구": "이수", "이수": "총신대입구"}, radius_km=0.5)
    assert set(g.values()) == set(range(1, max(g.values()) + 1))


def test_group_rows_name_and_centroid():
    g = assign_groups(S, aliases={}, radius_km=0.5)
    rows = {r.id: r for r in group_rows(S, g)}
    hongdae = rows[g[3]]
    assert hongdae.name == "홍대입구" and hongdae.node_count == 3
    assert abs(hongdae.lat - 37.5575) < 0.001


def test_parse_transfer_minutes_keys_by_normalized_name_and_lines():
    rows = [{"호선": "2호선", "환승역명": "홍대입구", "환승노선": "경의중앙선", "환승소요시간": "3"}]
    table = parse_transfer_minutes(rows)
    assert table[("홍대입구", "2호선", "경의중앙선")] == 3.0


def test_build_transfers_uses_table_then_default():
    g = assign_groups(S, aliases={}, radius_km=0.5)
    table = {("홍대입구", "2호선", "경의중앙선"): 3.0}
    transfers = {(t.from_id, t.to_id): t for t in build_transfers(S, g, table)}
    assert transfers[(3, 4)] == Transfer(3, 4, 3.0, "measured")
    assert transfers[(3, 5)] == Transfer(3, 5, 4.0, "default")
    assert (1, 2) not in transfers
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_groups.py -v`
Expected: FAIL, `No module named 'pipeline.groups'`

- [ ] **Step 3: groups.py 작성**

`backend/pipeline/groups.py`:
```python
"""물리적으로 같은 역을 그룹으로 묶고 환승 간선을 만든다.

실행: python -m pipeline.groups (stations.csv를 읽고 group_id를 채워 다시 쓴다)
"""

from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass

from app.geo import haversine_km
from pipeline.config import COLUMNS, DEFAULT_TRANSFER_MIN, GROUP_RADIUS_KM, MANUAL_DIR, OUT_DIR, canonical_line
from pipeline.edges import load_aliases, load_stations
from pipeline.io import pick, read_csv_rows, require_raw, write_csv
from pipeline.names import normalize_station_name
from pipeline.stations import STATION_FIELDS, StationRow

GROUP_FIELDS = ("id", "name", "lat", "lng", "node_count")
TRANSFER_FIELDS = ("from_id", "to_id", "minutes", "source")


@dataclass(frozen=True)
class GroupRow:
    id: int
    name: str
    lat: float
    lng: float
    node_count: int


@dataclass(frozen=True)
class Transfer:
    from_id: int
    to_id: int
    minutes: float
    source: str  # measured 또는 default


class _UnionFind:
    def __init__(self, ids: Iterable[int]) -> None:
        self._parent = {i: i for i in ids}

    def find(self, i: int) -> int:
        while self._parent[i] != i:
            self._parent[i] = self._parent[self._parent[i]]
            i = self._parent[i]
        return i

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self._parent[max(ra, rb)] = min(ra, rb)


def _name_key(name: str, aliases: dict[str, str]) -> str:
    other = aliases.get(name)
    return min(name, other) if other else name


def assign_groups(stations: Sequence[StationRow], aliases: dict[str, str], radius_km: float = GROUP_RADIUS_KM) -> dict[int, int]:
    uf = _UnionFind(s.id for s in stations)
    by_key: dict[str, list[StationRow]] = {}
    for s in stations:
        by_key.setdefault(_name_key(s.name, aliases), []).append(s)
    for members in by_key.values():
        for i, a in enumerate(members):
            for b in members[i + 1 :]:
                if haversine_km(a.lat, a.lng, b.lat, b.lng) <= radius_km:
                    uf.union(a.id, b.id)
    roots = sorted({uf.find(s.id) for s in stations})
    group_id_of_root = {root: i + 1 for i, root in enumerate(roots)}
    return {s.id: group_id_of_root[uf.find(s.id)] for s in stations}


def group_rows(stations: Sequence[StationRow], group_of: dict[int, int]) -> list[GroupRow]:
    members: dict[int, list[StationRow]] = {}
    for s in stations:
        members.setdefault(group_of[s.id], []).append(s)
    rows = []
    for gid in sorted(members):
        ms = members[gid]
        name = Counter(s.name for s in ms).most_common(1)[0][0]
        rows.append(GroupRow(gid, name, round(sum(s.lat for s in ms) / len(ms), 6), round(sum(s.lng for s in ms) / len(ms), 6), len(ms)))
    return rows


def parse_transfer_minutes(rows: Iterable[dict[str, str]]) -> dict[tuple[str, str, str], float]:
    cols = COLUMNS["transfer"]
    table: dict[tuple[str, str, str], float] = {}
    for row in rows:
        line = canonical_line(pick(row, cols["line"]))
        to_line = canonical_line(pick(row, cols["to_line"]))
        raw_minutes = pick(row, cols["minutes"], required=False).strip()
        if line is None or to_line is None or not raw_minutes:
            continue
        try:
            minutes = float(raw_minutes)
        except ValueError:
            continue
        table[(normalize_station_name(pick(row, cols["name"])), line, to_line)] = minutes
    return table


def build_transfers(stations: Sequence[StationRow], group_of: dict[int, int], minutes_table: dict[tuple[str, str, str], float]) -> list[Transfer]:
    members: dict[int, list[StationRow]] = {}
    for s in stations:
        members.setdefault(group_of[s.id], []).append(s)
    transfers: list[Transfer] = []
    for ms in members.values():
        for i, a in enumerate(ms):
            for b in ms[i + 1 :]:
                measured = minutes_table.get((a.name, a.line, b.line)) or minutes_table.get((b.name, b.line, a.line))
                if measured is not None:
                    transfers.append(Transfer(a.id, b.id, measured, "measured"))
                else:
                    transfers.append(Transfer(a.id, b.id, DEFAULT_TRANSFER_MIN, "default"))
    return transfers


def main() -> None:
    stations = load_stations(OUT_DIR / "stations.csv")
    aliases = load_aliases(MANUAL_DIR / "station_aliases.csv")
    group_of = assign_groups(stations, aliases)
    groups = group_rows(stations, group_of)
    table = parse_transfer_minutes(read_csv_rows(require_raw("transfers")))
    transfers = build_transfers(stations, group_of, table)
    write_csv(OUT_DIR / "station_groups.csv", GROUP_FIELDS, [asdict(g) for g in groups])
    write_csv(OUT_DIR / "transfers.csv", TRANSFER_FIELDS, [asdict(t) for t in transfers])
    write_csv(OUT_DIR / "stations.csv", STATION_FIELDS, [{**asdict(s), "group_id": group_of[s.id]} for s in stations])
    measured = sum(1 for t in transfers if t.source == "measured")
    print(f"groups: {len(groups)}, transfers: {len(transfers)} ({measured} measured)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_groups.py -v`
Expected: 7 PASS

- [ ] **Step 5: 커밋**

```bash
git add pipeline/groups.py tests/pipeline/test_groups.py
git commit -m "feat: group physically identical stations and build transfer edges"
```

---

### Task 8: manual 역 순서 파일 (데이터 없는 6개 노선)

**Files:**
- Create: `backend/data/manual/line_orders.csv`
- Test: `backend/tests/pipeline/test_manual_data.py`

**Interfaces:**
- Consumes: `parse_manual_segments` (Task 6), `load_stations`
- Produces: 6개 노선의 역 순서. 형식 `line,seq,name`.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/pipeline/test_manual_data.py`:
```python
from pipeline.config import MANUAL_DIR
from pipeline.edges import parse_manual_segments
from pipeline.io import read_csv_rows

EXPECTED_LINES = {"우이신설선", "신림선", "김포골드라인", "의정부경전철", "서해선", "GTX-A"}


def test_line_orders_cover_six_lines_with_unique_sequences():
    rows = read_csv_rows(MANUAL_DIR / "line_orders.csv")
    segs = parse_manual_segments(rows)
    assert set(segs) == EXPECTED_LINES
    for line in EXPECTED_LINES:
        names = [n for n, _, _ in segs[line][0]]
        assert len(names) >= 9, line
        assert len(set(names)) == len(names), line
    seqs = {(r["line"], r["seq"]) for r in rows}
    assert len(seqs) == len(rows)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_manual_data.py -v`
Expected: FAIL, 파일 없음

- [ ] **Step 3: line_orders.csv 작성**

`backend/data/manual/line_orders.csv` (2026년 기준 개통 역. 역명은 표준데이터 표기와 맞춰야 하며 Task 9 실행에서 매칭 실패가 나오면 여기서 고친다):
```csv
line,seq,name
우이신설선,1,북한산우이
우이신설선,2,솔밭공원
우이신설선,3,4.19민주묘지
우이신설선,4,가오리
우이신설선,5,화계
우이신설선,6,삼양
우이신설선,7,삼양사거리
우이신설선,8,솔샘
우이신설선,9,북한산보국문
우이신설선,10,정릉
우이신설선,11,성신여대입구
우이신설선,12,보문
우이신설선,13,신설동
신림선,1,샛강
신림선,2,대방
신림선,3,서울지방병무청
신림선,4,보라매
신림선,5,보라매공원
신림선,6,보라매병원
신림선,7,당곡
신림선,8,신림
신림선,9,서원
신림선,10,서울대벤처타운
신림선,11,관악산
김포골드라인,1,양촌
김포골드라인,2,구래
김포골드라인,3,마산
김포골드라인,4,장기
김포골드라인,5,운양
김포골드라인,6,걸포북변
김포골드라인,7,사우
김포골드라인,8,풍무
김포골드라인,9,고촌
김포골드라인,10,김포공항
의정부경전철,1,발곡
의정부경전철,2,회룡
의정부경전철,3,범골
의정부경전철,4,경전철의정부
의정부경전철,5,의정부시청
의정부경전철,6,흥선
의정부경전철,7,의정부중앙
의정부경전철,8,동오
의정부경전철,9,새말
의정부경전철,10,경기도청북부청사
의정부경전철,11,효자
의정부경전철,12,곤제
의정부경전철,13,어룡
의정부경전철,14,송산
의정부경전철,15,탑석
서해선,1,일산
서해선,2,풍산
서해선,3,백마
서해선,4,곡산
서해선,5,대곡
서해선,6,능곡
서해선,7,김포공항
서해선,8,원종
서해선,9,부천종합운동장
서해선,10,소사
서해선,11,소새울
서해선,12,시흥대야
서해선,13,신천
서해선,14,신현
서해선,15,시흥시청
서해선,16,시흥능곡
서해선,17,달미
서해선,18,선부
서해선,19,초지
서해선,20,시우
서해선,21,원시
GTX-A,1,운정중앙
GTX-A,2,킨텍스
GTX-A,3,대곡
GTX-A,4,연신내
GTX-A,5,서울역
GTX-A,6,수서
GTX-A,7,성남
GTX-A,8,구성
GTX-A,9,동탄
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_manual_data.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add data/manual/line_orders.csv tests/pipeline/test_manual_data.py
git commit -m "feat: manual station orders for lines without open distance data"
```

---

### Task 9: times 단계 (다익스트라)

**Files:**
- Create: `backend/pipeline/times.py`
- Test: `backend/tests/pipeline/test_times.py`

**Interfaces:**
- Consumes: `Edge`, `Transfer` 형태의 CSV (`edges.csv`, `transfers.csv`), `manual/hubs.csv`의 `group_id`, `stations.csv`의 `group_id`
- Produces: `build_adjacency(edges: Iterable[tuple[int, int, float]]) -> dict[int, list[tuple[int, float]]]` (양방향); `dijkstra(adj, source) -> dict[int, float]`; `compute_station_times(adj, sources, targets) -> list[tuple[int, int, int]]` (from, to, 반올림 분; 도달 불가는 생략); `hub_node_ids(stations_rows, hub_group_ids) -> set[int]`; `TIME_FIELDS`; `main()`이 `out/station_times.csv`를 씀.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/pipeline/test_times.py`:
```python
from pipeline.times import build_adjacency, compute_station_times, dijkstra, hub_node_ids

# 1-2-3 선형, 3과 4는 환승(3분), 4-5 선형, 6은 고립
EDGES = [(1, 2, 2.0), (2, 3, 2.5), (4, 5, 3.0), (3, 4, 3.0)]


def test_adjacency_is_bidirectional():
    adj = build_adjacency(EDGES)
    assert (1, 2.0) in adj[2] and (2, 2.0) in adj[1]


def test_dijkstra_sums_transfer_and_ride():
    dist = dijkstra(build_adjacency(EDGES), 1)
    assert dist[5] == 2.0 + 2.5 + 3.0 + 3.0
    assert 6 not in dist


def test_compute_station_times_rounds_and_skips_unreachable():
    adj = build_adjacency(EDGES + [(6, 6, 0.0)])
    rows = compute_station_times(adj, sources=[1, 6], targets={5, 1})
    assert (1, 5, 10) in rows or (1, 5, 11) in rows
    assert (1, 1, 0) in rows
    assert all(r[0] != 6 or r[1] == 6 for r in rows)


def test_hub_node_ids_selects_nodes_in_hub_groups():
    stations = [
        {"id": "1", "group_id": "10"},
        {"id": "2", "group_id": "10"},
        {"id": "3", "group_id": "11"},
    ]
    assert hub_node_ids(stations, {10}) == {1, 2}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_times.py -v`
Expected: FAIL, `No module named 'pipeline.times'`

- [ ] **Step 3: times.py 작성**

`backend/pipeline/times.py`:
```python
"""모든 역 노드에서 거점 노드까지 최단 소요시간(분)을 계산해 out/station_times.csv를 만든다.

실행: python -m pipeline.times
"""

import heapq
from collections.abc import Iterable

from pipeline.config import MANUAL_DIR, OUT_DIR
from pipeline.io import read_csv_rows, write_csv

TIME_FIELDS = ("from_station_id", "to_station_id", "minutes")


def build_adjacency(edges: Iterable[tuple[int, int, float]]) -> dict[int, list[tuple[int, float]]]:
    adj: dict[int, list[tuple[int, float]]] = {}
    for a, b, w in edges:
        adj.setdefault(a, []).append((b, w))
        adj.setdefault(b, []).append((a, w))
    return adj


def dijkstra(adj: dict[int, list[tuple[int, float]]], source: int) -> dict[int, float]:
    dist = {source: 0.0}
    heap = [(0.0, source)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist.get(u, float("inf")):
            continue
        for v, w in adj.get(u, ()):
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    return dist


def compute_station_times(adj: dict[int, list[tuple[int, float]]], sources: Iterable[int], targets: set[int]) -> list[tuple[int, int, int]]:
    rows: list[tuple[int, int, int]] = []
    for s in sources:
        dist = dijkstra(adj, s)
        for t in sorted(targets):
            if t in dist:
                rows.append((s, t, int(round(dist[t]))))
    return rows


def hub_node_ids(station_rows: Iterable[dict[str, str]], hub_group_ids: set[int]) -> set[int]:
    return {int(r["id"]) for r in station_rows if r["group_id"] and int(r["group_id"]) in hub_group_ids}


def main() -> None:
    stations = read_csv_rows(OUT_DIR / "stations.csv")
    edges = [(int(r["from_id"]), int(r["to_id"]), float(r["minutes"])) for r in read_csv_rows(OUT_DIR / "edges.csv")]
    transfers = [(int(r["from_id"]), int(r["to_id"]), float(r["minutes"])) for r in read_csv_rows(OUT_DIR / "transfers.csv")]
    hub_groups = {int(r["group_id"]) for r in read_csv_rows(MANUAL_DIR / "hubs.csv")}
    targets = hub_node_ids(stations, hub_groups)
    adj = build_adjacency(edges + transfers)
    rows = compute_station_times(adj, [int(r["id"]) for r in stations], targets)
    write_csv(OUT_DIR / "station_times.csv", TIME_FIELDS, [dict(zip(TIME_FIELDS, r)) for r in rows])
    print(f"station_times: {len(rows)} rows for {len(targets)} hub nodes")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_times.py -v`
Expected: 4 PASS

- [ ] **Step 5: 커밋**

```bash
git add pipeline/times.py tests/pipeline/test_times.py
git commit -m "feat: all-source shortest travel times to hub nodes"
```

---

### Task 10: validate 단계

**Files:**
- Create: `backend/pipeline/validate.py`
- Test: `backend/tests/pipeline/test_validate.py`

**Interfaces:**
- Consumes: out CSV 5개, `manual/hubs.csv`, `manual/line_classes.csv`, `MAX_EDGE_KM`, `METRO_*_RANGE`, `build_adjacency`, `dijkstra`
- Produces: 규칙 함수들 (각각 `list[str]` 문제 목록 반환): `check_bbox(stations)`, `check_edge_lengths(edges, classes)`, `check_connectivity(station_ids, edges, transfers) -> list[str]`, `check_hubs_have_nodes(hubs, stations)`, `check_times_complete(stations, hub_nodes, times)`, `check_sanity(groups, stations, times_lookup, cases)`, `report_same_name_groups(groups) -> list[str]`; `SANITY_CASES`; `run_all_checks() -> list[str]`; CLI는 문제가 있으면 출력 후 종료 코드 1.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/pipeline/test_validate.py`:
```python
from pipeline.validate import (
    check_bbox,
    check_connectivity,
    check_edge_lengths,
    check_hubs_have_nodes,
    check_sanity,
    check_times_complete,
    report_same_name_groups,
)

STATIONS = [
    {"id": "1", "name": "홍대입구", "line": "2호선", "lat": "37.5571", "lng": "126.9245", "group_id": "1"},
    {"id": "2", "name": "강남", "line": "2호선", "lat": "37.4979", "lng": "127.0276", "group_id": "2"},
    {"id": "3", "name": "외딴역", "line": "2호선", "lat": "37.5", "lng": "127.1", "group_id": "3"},
]
GROUPS = [
    {"id": "1", "name": "홍대입구"}, {"id": "2", "name": "강남"}, {"id": "3", "name": "외딴역"},
]


def test_bbox_flags_out_of_range():
    bad = STATIONS + [{"id": "9", "name": "부산", "line": "2호선", "lat": "35.1", "lng": "129.0", "group_id": "9"}]
    problems = check_bbox(bad)
    assert len(problems) == 1 and "부산" in problems[0]
    assert check_bbox(STATIONS) == []


def test_edge_length_uses_class_limit():
    edges = [{"from_id": "1", "to_id": "2", "line": "2호선", "km": "8.5"}]
    assert check_edge_lengths(edges, {"2호선": "urban"}) != []
    assert check_edge_lengths(edges, {"2호선": "regional"}) == []


def test_connectivity_reports_components():
    edges = [{"from_id": "1", "to_id": "2"}]
    problems = check_connectivity([1, 2, 3], edges, [])
    assert len(problems) == 1 and "2" in problems[0]
    assert check_connectivity([1, 2, 3], edges + [{"from_id": "2", "to_id": "3"}], []) == []


def test_hubs_need_at_least_one_node():
    hubs = [{"group_id": "1", "name": "홍대입구"}, {"group_id": "7", "name": "없는거점"}]
    problems = check_hubs_have_nodes(hubs, STATIONS)
    assert len(problems) == 1 and "없는거점" in problems[0]


def test_times_complete_requires_every_pair():
    times = [{"from_station_id": "1", "to_station_id": "2", "minutes": "35"}]
    problems = check_times_complete(STATIONS, hub_nodes={2}, times=times)
    assert any("2 -> 2" in p for p in problems) and any("3 -> 2" in p for p in problems)


def test_sanity_uses_group_names_and_range():
    lookup = {(1, 2): 40, (2, 1): 40}
    cases = [("홍대입구", "강남", 30, 45)]
    assert check_sanity(GROUPS, STATIONS, lookup, cases) == []
    assert check_sanity(GROUPS, STATIONS, {(1, 2): 70}, cases) != []
    assert check_sanity(GROUPS, STATIONS, {}, cases) != []


def test_same_name_groups_reported_not_failed():
    groups = GROUPS + [{"id": "4", "name": "홍대입구"}]
    report = report_same_name_groups(groups)
    assert report == ["홍대입구: groups [1, 4]"]
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_validate.py -v`
Expected: FAIL, `No module named 'pipeline.validate'`

- [ ] **Step 3: validate.py 작성**

`backend/pipeline/validate.py`:
```python
"""out/ 산출물이 적재 가능한 상태인지 검사한다. 문제가 하나라도 있으면 종료 코드 1.

실행: python -m pipeline.validate
"""

import sys
from collections.abc import Iterable, Sequence

from pipeline.config import MANUAL_DIR, MAX_EDGE_KM, METRO_LAT_RANGE, METRO_LNG_RANGE, OUT_DIR
from pipeline.edges import load_line_classes
from pipeline.io import read_csv_rows
from pipeline.times import build_adjacency, dijkstra, hub_node_ids

# (출발 그룹 이름, 도착 그룹 이름, 최소 분, 최대 분)
SANITY_CASES = [
    ("홍대입구", "강남", 30, 45),
    ("잠실", "강남", 12, 20),
    ("수원", "강남", 50, 75),
    ("부평", "서울", 45, 70),
    ("판교", "강남", 15, 30),
]


def check_bbox(stations: Iterable[dict[str, str]]) -> list[str]:
    out = []
    for s in stations:
        lat, lng = float(s["lat"]), float(s["lng"])
        if not (METRO_LAT_RANGE[0] <= lat <= METRO_LAT_RANGE[1] and METRO_LNG_RANGE[0] <= lng <= METRO_LNG_RANGE[1]):
            out.append(f"경계 밖: {s['name']} ({s['line']}) {lat},{lng}")
    return out


def check_edge_lengths(edges: Iterable[dict[str, str]], classes: dict[str, str]) -> list[str]:
    out = []
    for e in edges:
        limit = MAX_EDGE_KM[classes.get(e["line"], "urban")]
        if float(e["km"]) > limit:
            out.append(f"간선 거리 초과: {e['line']} {e['from_id']}-{e['to_id']} {e['km']}km > {limit}km")
    return out


def check_connectivity(station_ids: Sequence[int], edges: Iterable[dict[str, str]], transfers: Iterable[dict[str, str]]) -> list[str]:
    links = [(int(r["from_id"]), int(r["to_id"]), 1.0) for r in list(edges) + list(transfers)]
    adj = build_adjacency(links)
    remaining = set(station_ids)
    components: list[set[int]] = []
    while remaining:
        start = min(remaining)
        reached = set(dijkstra(adj, start))
        components.append(reached & remaining or {start})
        remaining -= reached | {start}
    if len(components) <= 1:
        return []
    components.sort(key=len, reverse=True)
    return [f"연결 성분 {len(components)}개. 크기: {[len(c) for c in components]}. 작은 성분 예시 노드: {sorted(components[1])[:5]}"]


def check_hubs_have_nodes(hubs: Iterable[dict[str, str]], stations: Iterable[dict[str, str]]) -> list[str]:
    groups_with_nodes = {int(s["group_id"]) for s in stations if s["group_id"]}
    return [f"거점에 노드 없음: {h['name']} (group {h['group_id']})" for h in hubs if int(h["group_id"]) not in groups_with_nodes]


def check_times_complete(stations: Iterable[dict[str, str]], hub_nodes: set[int], times: Iterable[dict[str, str]]) -> list[str]:
    have = {(int(t["from_station_id"]), int(t["to_station_id"])) for t in times}
    out = []
    for s in stations:
        for h in sorted(hub_nodes):
            if (int(s["id"]), h) not in have:
                out.append(f"시간표 누락: {s['id']} -> {h}")
    return out


def _group_nodes(groups: Iterable[dict[str, str]], stations: Iterable[dict[str, str]]) -> dict[str, list[int]]:
    name_of_group = {int(g["id"]): g["name"] for g in groups}
    out: dict[str, list[int]] = {}
    for s in stations:
        if s["group_id"]:
            out.setdefault(name_of_group[int(s["group_id"])], []).append(int(s["id"]))
    return out


def check_sanity(groups, stations, times_lookup: dict[tuple[int, int], int], cases) -> list[str]:
    nodes = _group_nodes(groups, stations)
    out = []
    for src, dst, lo, hi in cases:
        candidates = [times_lookup[(a, b)] for a in nodes.get(src, []) for b in nodes.get(dst, []) if (a, b) in times_lookup]
        if not candidates:
            out.append(f"상식 검증 불가: {src} -> {dst} 시간 없음")
            continue
        best = min(candidates)
        if not (lo <= best <= hi):
            out.append(f"상식 검증 실패: {src} -> {dst} {best}분 (기대 {lo}~{hi})")
    return out


def report_same_name_groups(groups: Iterable[dict[str, str]]) -> list[str]:
    by_name: dict[str, list[int]] = {}
    for g in groups:
        by_name.setdefault(g["name"], []).append(int(g["id"]))
    return [f"{name}: groups {sorted(ids)}" for name, ids in sorted(by_name.items()) if len(ids) > 1]


def run_all_checks() -> list[str]:
    stations = read_csv_rows(OUT_DIR / "stations.csv")
    groups = read_csv_rows(OUT_DIR / "station_groups.csv")
    edges = read_csv_rows(OUT_DIR / "edges.csv")
    transfers = read_csv_rows(OUT_DIR / "transfers.csv")
    times = read_csv_rows(OUT_DIR / "station_times.csv")
    hubs = read_csv_rows(MANUAL_DIR / "hubs.csv")
    classes = load_line_classes(MANUAL_DIR / "line_classes.csv")
    hub_nodes = hub_node_ids(stations, {int(h["group_id"]) for h in hubs})
    lookup = {(int(t["from_station_id"]), int(t["to_station_id"])): int(t["minutes"]) for t in times}
    problems = []
    problems += check_bbox(stations)
    problems += check_edge_lengths(edges, classes)
    problems += check_connectivity([int(s["id"]) for s in stations], edges, transfers)
    problems += check_hubs_have_nodes(hubs, stations)
    problems += check_times_complete(stations, hub_nodes, times)
    problems += check_sanity(groups, stations, lookup, SANITY_CASES)
    for line in report_same_name_groups(groups):
        print("참고(같은 이름 다른 그룹):", line)
    return problems


if __name__ == "__main__":
    found = run_all_checks()
    for p in found[:200]:
        print("FAIL:", p)
    if found:
        print(f"검증 실패 {len(found)}건")
        sys.exit(1)
    print("검증 통과")
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_validate.py -v`
Expected: 7 PASS

- [ ] **Step 5: 커밋**

```bash
git add pipeline/validate.py tests/pipeline/test_validate.py
git commit -m "feat: validation rules for pipeline outputs"
```

---

### Task 11: load 단계와 run_all

**Files:**
- Create: `backend/pipeline/load.py`
- Create: `backend/pipeline/run_all.py`
- Test: `backend/tests/pipeline/test_load.py`, `backend/tests/pipeline/test_run_all.py`

**Interfaces:**
- Consumes: `Base`, `Station`, `StationGroup`, `Hub`, `StationTime` (app.models), out CSV, `manual/hubs.csv` (컬럼 `group_id,name,region,tags,vibe_summary`; tags는 세미콜론 구분)
- Produces: `load_all(engine, out_dir, manual_dir) -> dict[str, int]` (테이블별 행 수); CLI `python -m pipeline.load`가 `app.db.engine`에 적재. `run_all.main()`이 stations, edges, groups, times, validate 순으로 각 모듈의 `main()`을 호출하고 validate 실패 시 종료 코드 1.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/pipeline/test_load.py`:
```python
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.hubs import load_hub_candidates
from app.models import Base, Hub, Station, StationTime
from pipeline.io import write_csv
from pipeline.load import load_all


def _write_outputs(out: Path, manual: Path) -> None:
    write_csv(out / "station_groups.csv", ["id", "name", "lat", "lng", "node_count"], [
        {"id": 1, "name": "홍대입구", "lat": 37.5571, "lng": 126.9245, "node_count": 2},
        {"id": 2, "name": "강남", "lat": 37.4979, "lng": 127.0276, "node_count": 1},
    ])
    write_csv(out / "stations.csv", ["id", "name", "raw_name", "line", "operator", "lat", "lng", "region", "group_id"], [
        {"id": 1, "name": "홍대입구", "raw_name": "홍대입구", "line": "2호선", "operator": "서울교통공사", "lat": 37.5571, "lng": 126.9245, "region": "서울", "group_id": 1},
        {"id": 2, "name": "홍대입구", "raw_name": "홍대입구", "line": "경의중앙선", "operator": "한국철도공사", "lat": 37.5578, "lng": 126.9255, "region": "서울", "group_id": 1},
        {"id": 3, "name": "강남", "raw_name": "강남", "line": "2호선", "operator": "서울교통공사", "lat": 37.4979, "lng": 127.0276, "region": "서울", "group_id": 2},
    ])
    write_csv(out / "station_times.csv", ["from_station_id", "to_station_id", "minutes"], [
        {"from_station_id": 1, "to_station_id": 3, "minutes": 35},
        {"from_station_id": 2, "to_station_id": 3, "minutes": 38},
        {"from_station_id": 3, "to_station_id": 3, "minutes": 0},
        {"from_station_id": 1, "to_station_id": 1, "minutes": 0},
        {"from_station_id": 2, "to_station_id": 1, "minutes": 4},
        {"from_station_id": 3, "to_station_id": 1, "minutes": 35},
        {"from_station_id": 1, "to_station_id": 2, "minutes": 4},
        {"from_station_id": 2, "to_station_id": 2, "minutes": 0},
        {"from_station_id": 3, "to_station_id": 2, "minutes": 38},
    ])
    write_csv(manual / "hubs.csv", ["group_id", "name", "region", "tags", "vibe_summary"], [
        {"group_id": 1, "name": "홍대입구", "region": "서울", "tags": "밤늦게까지;20대", "vibe_summary": "밤늦게까지 북적이는 젊은 동네"},
        {"group_id": 2, "name": "강남", "region": "서울", "tags": "교통요지", "vibe_summary": "어디서든 오기 쉬운 교통 중심"},
    ])


def _engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng)
    return eng


def test_load_all_fills_tables_and_is_idempotent(tmp_path: Path):
    out, manual = tmp_path / "out", tmp_path / "manual"
    out.mkdir(); manual.mkdir()
    _write_outputs(out, manual)
    eng = _engine()
    counts = load_all(eng, out, manual)
    assert counts == {"station_groups": 2, "stations": 3, "hubs": 2, "station_times": 9}
    assert load_all(eng, out, manual) == counts
    with Session(eng) as s:
        hub = s.scalar(select(Hub).where(Hub.name == "홍대입구"))
        assert hub.tags == ["밤늦게까지", "20대"] and hub.group_id == 1 and hub.station_id == 1
        assert s.get(StationTime, (2, 3)).minutes == 38
        assert s.get(Station, 2).group_id == 1
        _, candidates = load_hub_candidates(s)
        assert {c.name: set(c.node_ids) for c in candidates} == {"홍대입구": {1, 2}, "강남": {3}}
```

`backend/tests/pipeline/test_run_all.py`:
```python
from pipeline import run_all


def test_run_all_stops_when_validate_fails(monkeypatch):
    calls: list[str] = []
    for name in ("stations", "edges", "groups", "times"):
        monkeypatch.setattr(run_all, f"run_{name}", lambda n=name: calls.append(n))
    monkeypatch.setattr(run_all, "run_validate", lambda: ["문제"])
    assert run_all.main() == 1
    assert calls == ["stations", "edges", "groups", "times"]


def test_run_all_returns_zero_when_clean(monkeypatch):
    for name in ("stations", "edges", "groups", "times"):
        monkeypatch.setattr(run_all, f"run_{name}", lambda: None)
    monkeypatch.setattr(run_all, "run_validate", lambda: [])
    assert run_all.main() == 0
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_load.py tests/pipeline/test_run_all.py -v`
Expected: FAIL, 모듈 없음

- [ ] **Step 3: load.py 작성**

`backend/pipeline/load.py`:
```python
"""out/ CSV를 DB에 적재한다. 기존 행을 지우고 다시 넣으므로 여러 번 실행해도 같다.

실행: python -m pipeline.load  (대상 DB는 .env의 DATABASE_URL)
"""

from collections.abc import Iterable
from pathlib import Path

from sqlalchemy import Engine, delete, insert

from app.models import Hub, Station, StationGroup, StationTime
from pipeline.config import MANUAL_DIR, OUT_DIR
from pipeline.io import read_csv_rows

BATCH = 1000


def _batched(rows: list[dict], size: int = BATCH) -> Iterable[list[dict]]:
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def _hub_rows(manual_dir: Path, stations: list[dict[str, str]]) -> list[dict]:
    representative: dict[int, int] = {}
    for s in stations:
        gid = int(s["group_id"])
        representative[gid] = min(representative.get(gid, int(s["id"])), int(s["id"]))
    lat_lng = {int(s["id"]): (float(s["lat"]), float(s["lng"])) for s in stations}
    rows = []
    for i, h in enumerate(read_csv_rows(manual_dir / "hubs.csv"), start=1):
        gid = int(h["group_id"])
        rep = representative[gid]
        rows.append({
            "id": i,
            "station_id": rep,
            "group_id": gid,
            "name": h["name"],
            "lat": lat_lng[rep][0],
            "lng": lat_lng[rep][1],
            "region": h["region"],
            "tags": [t.strip() for t in h["tags"].split(";") if t.strip()],
            "vibe_summary": h["vibe_summary"],
        })
    return rows


def load_all(engine: Engine, out_dir: Path = OUT_DIR, manual_dir: Path = MANUAL_DIR) -> dict[str, int]:
    stations = read_csv_rows(out_dir / "stations.csv")
    groups = [{"id": int(g["id"]), "name": g["name"], "lat": float(g["lat"]), "lng": float(g["lng"])} for g in read_csv_rows(out_dir / "station_groups.csv")]
    station_rows = [{"id": int(s["id"]), "name": s["name"], "line": s["line"], "lat": float(s["lat"]), "lng": float(s["lng"]), "group_id": int(s["group_id"])} for s in stations]
    hub_rows = _hub_rows(manual_dir, stations)
    time_rows = [{"from_station_id": int(t["from_station_id"]), "to_station_id": int(t["to_station_id"]), "minutes": int(t["minutes"])} for t in read_csv_rows(out_dir / "station_times.csv")]

    with engine.begin() as conn:
        for table in (StationTime, Hub, Station, StationGroup):
            conn.execute(delete(table))
        for table, rows in ((StationGroup, groups), (Station, station_rows), (Hub, hub_rows), (StationTime, time_rows)):
            for chunk in _batched(rows):
                conn.execute(insert(table), chunk)
    return {"station_groups": len(groups), "stations": len(station_rows), "hubs": len(hub_rows), "station_times": len(time_rows)}


if __name__ == "__main__":
    from app.db import engine as app_engine

    for name, count in load_all(app_engine).items():
        print(f"{name}: {count}")
```

- [ ] **Step 4: run_all.py 작성**

`backend/pipeline/run_all.py`:
```python
"""stations -> edges -> groups -> times -> validate 를 순서대로 실행한다. load는 따로 실행한다.

실행: python -m pipeline.run_all
"""

import sys

from pipeline import edges, groups, stations, times, validate


def run_stations() -> None:
    stations.main()


def run_edges() -> None:
    edges.main()


def run_groups() -> None:
    groups.main()


def run_times() -> None:
    times.main()


def run_validate() -> list[str]:
    return validate.run_all_checks()


def main() -> int:
    run_stations()
    run_edges()
    run_groups()
    run_times()
    problems = run_validate()
    for p in problems[:200]:
        print("FAIL:", p)
    if problems:
        print(f"검증 실패 {len(problems)}건")
        return 1
    print("검증 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/pipeline -q`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add pipeline/load.py pipeline/run_all.py tests/pipeline/test_load.py tests/pipeline/test_run_all.py
git commit -m "feat: database loader and end to end pipeline runner"
```

---

### Task 12: 거점 점수 (카카오)

**Files:**
- Modify: `backend/app/places/kakao_local.py` (`count_category`, `count_keyword` 추가)
- Create: `backend/pipeline/hubs.py`
- Test: `backend/tests/test_places.py` (count 메서드 테스트 추가), `backend/tests/pipeline/test_hubs.py`

**Interfaces:**
- Produces (client): `KakaoLocalClient.count_category(code, lat, lng, radius=600) -> int`, `count_keyword(query, lat, lng, radius=600) -> int` (응답 `meta.total_count`)
- Produces (pipeline): `HubScore(group_id, name, region, food, cafe, play, score)`; `score_group(client, group, radius_m) -> HubScore`; `PLAY_WEIGHT = 3`; `load_cache(path) -> dict[int, dict]`, `save_cache(path, cache)`; `main()`이 `out/hub_scores_cache.json`을 갱신하며 `out/hub_candidates.csv`(점수 상위 150)를 씀. region은 그룹 대표 노드(id 최소)의 stations.csv region.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/test_places.py` 끝에 추가:
```python
@respx.mock
def test_count_category_returns_meta_total():
    respx.get(CATEGORY_URL).mock(return_value=httpx.Response(200, json={"meta": {"total_count": 42}, "documents": []}))
    assert KakaoLocalClient("k").count_category("FD6", 37.5, 127.0) == 42


@respx.mock
def test_count_keyword_returns_meta_total():
    respx.get(KEYWORD_URL).mock(return_value=httpx.Response(200, json={"meta": {"total_count": 7}, "documents": []}))
    assert KakaoLocalClient("k").count_keyword("방탈출", 37.5, 127.0) == 7
```

`backend/tests/pipeline/test_hubs.py`:
```python
import json
from pathlib import Path

from pipeline.hubs import HubScore, load_cache, save_cache, score_group, select_candidates


class FakeClient:
    def count_category(self, code, lat, lng, radius=600):
        return {"FD6": 120, "CE7": 40}[code]

    def count_keyword(self, query, lat, lng, radius=600):
        return 2


def test_score_group_weights_play_three_times():
    group = {"id": "1", "name": "홍대입구", "lat": "37.5571", "lng": "126.9245", "region": "서울"}
    score = score_group(FakeClient(), group, radius_m=600)
    assert score == HubScore(1, "홍대입구", "서울", 120, 40, 10, 120 + 40 + 30)


def test_cache_round_trip(tmp_path: Path):
    p = tmp_path / "c.json"
    save_cache(p, {1: {"food": 1, "cafe": 2, "play": 3}})
    assert load_cache(p) == {1: {"food": 1, "cafe": 2, "play": 3}}
    assert load_cache(tmp_path / "missing.json") == {}


def test_select_candidates_keeps_top_n_by_score():
    scores = [HubScore(i, f"g{i}", "서울", 0, 0, 0, i) for i in range(1, 11)]
    top = select_candidates(scores, n=3)
    assert [s.group_id for s in top] == [10, 9, 8]
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/Scripts/pytest tests/test_places.py tests/pipeline/test_hubs.py -v`
Expected: FAIL, `count_category` 없음, `pipeline.hubs` 없음

- [ ] **Step 3: kakao_local.py에 메서드 추가**

`KakaoLocalClient`에 추가:
```python
    def _total(self, path: str, params: dict) -> int:
        response = self._client.get(f"{KAKAO_LOCAL_BASE}/{path}", params=params, headers=self._headers)
        response.raise_for_status()
        return int(response.json().get("meta", {}).get("total_count", 0))

    def count_category(self, code: str, lat: float, lng: float, radius: int = 600) -> int:
        return self._total("category.json", {"category_group_code": code, "x": lng, "y": lat, "radius": radius, "size": 1})

    def count_keyword(self, query: str, lat: float, lng: float, radius: int = 600) -> int:
        return self._total("keyword.json", {"query": query, "x": lng, "y": lat, "radius": radius, "size": 1})
```

- [ ] **Step 4: pipeline/hubs.py 작성**

`backend/pipeline/hubs.py`:
```python
"""역 그룹마다 주변 장소 개수를 세어 거점 후보 상위 150곳을 뽑는다. 카카오 REST 키 필요.

실행: python -m pipeline.hubs   (중단해도 hub_scores_cache.json 덕에 이어서 실행된다)
"""

import json
from dataclasses import asdict, dataclass
from pathlib import Path

import httpx

from app.config import get_settings
from app.places.kakao_local import KakaoLocalClient
from app.places.service import PLAY_KEYWORDS
from pipeline.config import OUT_DIR
from pipeline.io import read_csv_rows, write_csv

PLAY_WEIGHT = 3
RADIUS_M = 600
TOP_N = 150
CANDIDATE_FIELDS = ("group_id", "name", "region", "food", "cafe", "play", "score")


@dataclass(frozen=True)
class HubScore:
    group_id: int
    name: str
    region: str
    food: int
    cafe: int
    play: int
    score: int


def score_group(client, group: dict[str, str], radius_m: int = RADIUS_M) -> HubScore:
    lat, lng = float(group["lat"]), float(group["lng"])
    food = client.count_category("FD6", lat, lng, radius=radius_m)
    cafe = client.count_category("CE7", lat, lng, radius=radius_m)
    play = sum(client.count_keyword(k, lat, lng, radius=radius_m) for k in PLAY_KEYWORDS)
    return HubScore(int(group["id"]), group["name"], group.get("region", ""), food, cafe, play, food + cafe + PLAY_WEIGHT * play)


def load_cache(path: Path) -> dict[int, dict]:
    if not path.exists():
        return {}
    return {int(k): v for k, v in json.loads(path.read_text(encoding="utf-8")).items()}


def save_cache(path: Path, cache: dict[int, dict]) -> None:
    path.write_text(json.dumps({str(k): v for k, v in cache.items()}, ensure_ascii=False, indent=0), encoding="utf-8")


def select_candidates(scores: list[HubScore], n: int = TOP_N) -> list[HubScore]:
    return sorted(scores, key=lambda s: (-s.score, s.group_id))[:n]


def _groups_with_region() -> list[dict[str, str]]:
    stations = read_csv_rows(OUT_DIR / "stations.csv")
    region_of_group: dict[str, str] = {}
    for s in sorted(stations, key=lambda r: int(r["id"])):
        region_of_group.setdefault(s["group_id"], s["region"])
    return [{**g, "region": region_of_group.get(g["id"], "")} for g in read_csv_rows(OUT_DIR / "station_groups.csv")]


def main() -> None:
    key = get_settings().kakao_rest_key.strip()
    if not key:
        raise SystemExit("KAKAO_REST_KEY가 .env에 없습니다")
    client = KakaoLocalClient(key, client=httpx.Client(timeout=10.0))
    cache_path = OUT_DIR / "hub_scores_cache.json"
    cache = load_cache(cache_path)
    groups = _groups_with_region()
    scores: list[HubScore] = []
    try:
        for g in groups:
            gid = int(g["id"])
            if gid not in cache:
                s = score_group(client, g)
                cache[gid] = {"food": s.food, "cafe": s.cafe, "play": s.play}
                if len(cache) % 20 == 0:
                    save_cache(cache_path, cache)
            c = cache[gid]
            scores.append(HubScore(gid, g["name"], g["region"], c["food"], c["cafe"], c["play"], c["food"] + c["cafe"] + PLAY_WEIGHT * c["play"]))
    finally:
        save_cache(cache_path, cache)
    top = select_candidates(scores)
    write_csv(OUT_DIR / "hub_candidates.csv", CANDIDATE_FIELDS, [asdict(s) for s in top])
    print(f"hub candidates: {len(top)} of {len(groups)} groups -> {OUT_DIR / 'hub_candidates.csv'}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/test_places.py tests/pipeline/test_hubs.py -v`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add app/places/kakao_local.py pipeline/hubs.py tests/test_places.py tests/pipeline/test_hubs.py
git commit -m "feat: score station groups by nearby places for hub candidates"
```

---

### Task 13: 실제 데이터로 stations, edges, groups 실행

이 태스크는 코드보다 데이터 판단이 많다. 목표는 `python -m pipeline.stations`, `edges`, `groups`가 실제 원본으로 오류 없이 도는 것이다. hubs.csv가 아직 없으므로 times와 validate는 Task 15에서 돈다.

**Files:**
- Modify: `backend/pipeline/config.py` (LINE_ALIASES, COLUMNS 보정)
- Modify: `backend/data/manual/station_aliases.csv`, `backend/data/manual/line_orders.csv` (매칭 실패 해결)
- Modify: `backend/pipeline/edges.py` (1호선 코레일 구간 필터 조정이 필요하면)
- Create: `backend/data/out/stations.csv`, `edges.csv`, `station_groups.csv`, `transfers.csv`

- [ ] **Step 1: stations 실행과 노선별 개수 확인**

```bash
.venv/Scripts/python -m pipeline.stations
.venv/Scripts/python -c "import collections; from pipeline.io import read_csv_rows; from pipeline.config import OUT_DIR; print(collections.Counter(r['line'] for r in read_csv_rows(OUT_DIR/'stations.csv')).most_common())"
```
Expected: 24개 노선 전부 등장. 0개인 노선은 표준데이터의 노선명 표기가 LINE_ALIASES에 없는 것이므로 추가. 경전철 노선이 표준데이터에 아예 없으면 `data/manual/extra_stations.csv` (`name,line,operator,lat,lng,region`)를 만들고 `stations.main()`에서 표준데이터 뒤에 이어 붙이도록 `parse_standard` 호출 뒤 `StationRow`를 추가하는 코드를 넣는다 (id는 이어서 부여). 좌표는 카카오 지오코더로 "OO역"을 검색해 채우고 `SOURCES.md`에 그 사실을 적는다.

- [ ] **Step 2: edges 실행과 매칭 실패 해결**

```bash
.venv/Scripts/python -m pipeline.edges
```
`MatchError`가 나오면 목록을 보고 원인별로 고친다:
- 표기 차이(예: "동대문역사문화공원" vs "동대문역사문화공원(DDP)"): 정규화가 못 잡는 경우 `station_aliases.csv`에 추가.
- 노선명 차이: `LINE_ALIASES`에 추가.
- 원본에는 있는데 표준데이터에 없는 역(신설역): `extra_stations.csv`에 추가.
- 1호선 코레일 구간이 통째로 빠지면 `edges.main()`의 krail 필터를 "서울교통공사 파일이 다루는 (line, from, to) 쌍만 제외"로 바꾼다.
성공 시 `edges: N rows (M measured)`가 출력된다. N은 700~900 사이, M은 250~300 사이가 정상 범위.

- [ ] **Step 3: groups 실행과 같은 이름 다른 그룹 확인**

```bash
.venv/Scripts/python -m pipeline.groups
.venv/Scripts/python -c "from pipeline.io import read_csv_rows; from pipeline.config import OUT_DIR; from pipeline.validate import report_same_name_groups; print('\n'.join(report_same_name_groups(read_csv_rows(OUT_DIR/'station_groups.csv'))))"
```
출력된 같은 이름 목록을 검토한다. 신촌, 양평은 분리가 맞다. 실제로는 같은 역인데 500m 넘게 떨어져 분리된 경우(예: 넓은 환승역)가 있으면 `station_aliases.csv`로는 못 잡으므로 `config.GROUP_RADIUS_KM`를 0.6까지만 올려 재확인하고, 그래도 안 되면 `manual/group_merges.csv` (`name,line_a,line_b`)를 도입해 `assign_groups` 호출 전에 강제 union한다. 이 파일을 도입하면 `test_groups.py`에 테스트를 하나 추가한다.

- [ ] **Step 4: 그룹과 환승 수 기록**

`groups: G, transfers: T (M measured)` 출력값을 `data/SOURCES.md` "확인된 사실"에 적는다. G는 550~700 사이가 정상.

- [ ] **Step 5: 테스트 전체 실행 후 커밋**

Run: `.venv/Scripts/pytest -q`
```bash
git add pipeline data/manual data/out/stations.csv data/out/edges.csv data/out/station_groups.csv data/out/transfers.csv data/SOURCES.md
git commit -m "feat: run pipeline on real data through groups stage"
```

---

### Task 14: 거점 후보 점수와 hubs.csv 초안

**Files:**
- Create: `backend/data/out/hub_candidates.csv`, `backend/data/out/hub_scores_cache.json`
- Create: `backend/data/manual/hubs.csv`
- Test: `backend/tests/pipeline/test_manual_data.py` (hubs.csv 형식 테스트 추가)

- [ ] **Step 1: 점수 실행**

```bash
.venv/Scripts/python -m pipeline.hubs
```
그룹 600개 x 7회 = 약 4,200회 호출. 중간에 실패하면 다시 실행하면 이어서 한다. 완료 후 `hub_candidates.csv` 상위 30개를 눈으로 확인한다. 홍대입구, 강남, 건대입구, 신촌, 잠실, 종로3가, 성수, 수원, 부평 같은 이름이 상위에 있어야 정상. 없으면 좌표(그룹 중심)나 반경을 의심한다.

- [ ] **Step 2: 실패하는 테스트 작성**

`backend/tests/pipeline/test_manual_data.py` 끝에 추가:
```python
def test_hubs_csv_has_100_rows_with_required_fields():
    rows = read_csv_rows(MANUAL_DIR / "hubs.csv")
    assert len(rows) == 100
    assert set(rows[0]) == {"group_id", "name", "region", "tags", "vibe_summary"}
    assert len({r["group_id"] for r in rows}) == 100
    for r in rows:
        assert r["region"] in {"서울", "경기", "인천"}, r
        assert 1 <= len(r["tags"].split(";")) <= 4, r
        assert 8 <= len(r["vibe_summary"]) <= 40, r
    regions = {reg: sum(1 for r in rows if r["region"] == reg) for reg in ("서울", "경기", "인천")}
    assert regions["서울"] >= 50 and regions["경기"] >= 20 and regions["인천"] >= 6
```

- [ ] **Step 3: hubs.csv 초안 작성**

`hub_candidates.csv` 150곳에서 100곳을 고른다. 기준: 지역별 서울 55~65, 경기 25~35, 인천 6~12. 같은 상권이 중복되면(예: 홍대입구와 합정과 상수) 점수 높은 하나만 남기되 성격이 다르면 둘 다 가능. 오피스 밀집만 높고 놀거리가 적은 곳(여의도 일부, 가산디지털단지)은 놀거리 점수가 낮으면 제외. 각 행에 태그 2~4개(세미콜론 구분, 예: `대학가;밤늦게까지;클럽`)와 분위기 한 줄(8~40자, 예: `밤늦게까지 북적이는 젊은 동네`)을 쓴다. 지역은 `hub_candidates.csv`의 region을 쓰되 빈 값이면 좌표로 판단해 채운다. 파일 형식:
```csv
group_id,name,region,tags,vibe_summary
```
(100행. 엠대시와 가운데 점 금지.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/Scripts/pytest tests/pipeline/test_manual_data.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add data/out/hub_candidates.csv data/out/hub_scores_cache.json data/manual/hubs.csv tests/pipeline/test_manual_data.py
git commit -m "feat: hub candidate scores and first draft of 100 meeting hubs"
```

---

### Task 15: times, validate, load 실행과 README

**Files:**
- Create: `backend/data/out/station_times.csv`
- Modify: `backend/pipeline/config.py`, `backend/data/manual/*` (검증 실패 해결에 필요한 만큼만)
- Modify: `backend/README.md` (데이터 적재 절차)
- Modify: `backend/.gitignore` 또는 루트 `.gitignore` (`backend/dev.db`는 이미 무시됨. `data/out/*.csv`는 커밋 대상)

- [ ] **Step 1: times와 validate 실행**

```bash
.venv/Scripts/python -m pipeline.times
.venv/Scripts/python -m pipeline.validate
```
실패 항목별 대응:
- 간선 거리 초과: 원본 파일의 역 순서가 뒤섞였거나 지선 시작점을 못 잡은 것. 해당 노선 세그먼트를 출력해 확인하고 파서의 세그먼트 시작 규칙이나 manual 순서를 고친다.
- 연결 성분 2개 이상: 작은 성분의 역들을 보고 환승 그룹이 안 묶인 것(별칭 필요)인지, 노선 자체가 끊긴 것(원본 누락, manual 필요)인지 판단해 고친다.
- 상식 검증 실패: 값이 범위 밖이면 어느 구간이 이상한지 다익스트라 경로를 출력해 본다(`dijkstra`에 prev 추적을 임시로 넣어 확인). 속도 상수 문제면 `SPEED_KMH` 조정, 환승 4분 기본값 문제면 `DEFAULT_TRANSFER_MIN` 조정. 조정값은 `SOURCES.md`에 기록.
- 시간표 누락: 연결 성분 문제와 같은 원인.
검증 통과까지 반복한다. 매 반복은 `python -m pipeline.run_all` 한 번으로 재생성된다.

- [ ] **Step 2: 로컬 DB 적재와 백엔드 동작 확인**

```bash
.venv/Scripts/python -m scripts.init_db
.venv/Scripts/python -m pipeline.load
```
`stations: N, hubs: 100, station_times: M` 출력 확인. 그 다음 서버를 띄우고:
```bash
.venv/Scripts/uvicorn app.main:app --port 8000
```
다른 터미널에서 방을 만들고 세 명을 역 id로 참여시켜 결과를 본다 (역 id는 `stations.csv`에서 홍대입구 2호선, 수원 1호선, 잠실 2호선을 찾는다):
```bash
curl -s -X POST localhost:8000/rooms -H "Content-Type: application/json" -d "{\"title\":\"test\",\"meet_date\":\"2026-10-10\"}"
curl -s -X POST localhost:8000/rooms/<slug>/participants -H "Content-Type: application/json" -d "{\"nickname\":\"a\",\"station_id\":<홍대입구>}"
curl -s -X POST localhost:8000/rooms/<slug>/participants -H "Content-Type: application/json" -d "{\"nickname\":\"b\",\"station_id\":<수원>}"
curl -s -X POST localhost:8000/rooms/<slug>/participants -H "Content-Type: application/json" -d "{\"nickname\":\"c\",\"station_id\":<잠실>}"
curl -s localhost:8000/rooms/<slug>/result
```
Expected: `status: ready`, 추천 5곳, 1위가 강남 또는 사당 근처(2호선과 4호선 교차, 수원에서 오기 쉬운 곳). 결과와 각자 소요시간을 보고서에 기록한다.

- [ ] **Step 3: README 갱신**

`backend/README.md`의 "데이터 적재" 절을 다음으로 교체:
```markdown
## 데이터 적재

역, 역간 시간표, 거점은 `pipeline/`이 만든 `data/out/*.csv`에서 적재한다. 원본은 `data/raw/`, 출처는 `data/SOURCES.md`.

```bash
.venv/Scripts/python -m scripts.init_db     # 처음 한 번
.venv/Scripts/python -m pipeline.load       # .env의 DATABASE_URL에 적재
```

원본을 갱신했거나 거점 목록(`data/manual/hubs.csv`)을 고쳤으면 다시 계산한다.

```bash
.venv/Scripts/python -m pipeline.run_all    # stations, edges, groups, times, validate
.venv/Scripts/python -m pipeline.load
```

거점 후보 점수를 다시 내려면 `python -m pipeline.hubs` (카카오 키 필요, 약 4,000회 호출).
적재 후 서버를 재시작해야 시간표 캐시가 갱신된다.
```

- [ ] **Step 4: 전체 테스트와 커밋**

Run: `.venv/Scripts/pytest -q`
```bash
git add data pipeline backend/README.md
git commit -m "feat: real station times, validated outputs and load procedure"
```

---

## 이 계획 다음에 올 계획

- `dev/active/frontend/`: Next.js 화면 3개, 카카오맵, 10초 폴링, Vercel 배포
- 운영: Supabase에 `pipeline.load` 실행, Railway 재시작
