"""run_all을 합성 원본(3개 노선, 12개 역)으로 끝까지 돌려 단계 사이 연결을 검사한다."""

from pathlib import Path

import pytest
from openpyxl import Workbook
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.models import Base
from pipeline import config, edges, groups, hubs, io, run_all, stations, times, validate
from pipeline.config import RawFile
from pipeline.io import read_csv_rows, write_csv
from pipeline.load import load_all

KRAIL_FILE = "국가철도공단_경의중앙선_역간거리.csv"
PATCHED_MODULES = (config, io, stations, edges, groups, times, validate, hubs)

# (역사명, 노선명, 위도, 경도, 운영기관명). 라온은 2호선과 경의중앙선, 사랑은 경의중앙선과 우이신설선 환승역.
STD_ROWS = [
    ("가람", "2호선", 37.5000, 127.0000, "서울교통공사"),
    ("나래", "2호선", 37.5000, 127.0110, "서울교통공사"),
    ("다솜", "2호선", 37.5000, 127.0220, "서울교통공사"),
    ("라온", "2호선", 37.5000, 127.0330, "서울교통공사"),
    ("라온", "경의중앙선", 37.5005, 127.0335, "한국철도공사"),
    ("마루", "경의중앙선", 37.5155, 127.0335, "한국철도공사"),
    ("바다", "경의중앙선", 37.5305, 127.0335, "한국철도공사"),
    ("사랑", "경의중앙선", 37.5455, 127.0335, "한국철도공사"),
    ("사랑", "우이신설선", 37.5458, 127.0340, "우이신설경전철"),
    ("아라", "우이신설선", 37.5548, 127.0340, "우이신설경전철"),
    ("자람", "우이신설선", 37.5638, 127.0340, "우이신설경전철"),
    ("차오름", "우이신설선", 37.5728, 127.0340, "우이신설경전철"),
]


def _write_raw(raw: Path) -> None:
    wb = Workbook()
    ws = wb.active
    ws.append(["역번호", "역사명", "노선명", "역위도", "역경도", "운영기관명", "역사도로명주소"])
    for i, (name, line, lat, lng, operator) in enumerate(STD_ROWS, start=1):
        ws.append([i, name, line, lat, lng, operator, "서울특별시 어딘가로 1"])
    wb.save(raw / "std.xlsx")
    write_csv(raw / "seoul_times.csv", ["연번", "호선", "역명", "소요시간", "역간거리(km)", "호선별누계(km)"], [
        {"연번": 1, "호선": "2", "역명": "가람", "소요시간": "00:00", "역간거리(km)": 0, "호선별누계(km)": 0},
        {"연번": 2, "호선": "2", "역명": "나래", "소요시간": "01:30", "역간거리(km)": 1.0, "호선별누계(km)": 1.0},
        {"연번": 3, "호선": "2", "역명": "다솜", "소요시간": "01:30", "역간거리(km)": 1.0, "호선별누계(km)": 2.0},
        {"연번": 4, "호선": "2", "역명": "라온", "소요시간": "02:00", "역간거리(km)": 1.0, "호선별누계(km)": 3.0},
    ])
    write_csv(raw / KRAIL_FILE, ["철도운영기관명", "선명", "역명", "역간거리"], [
        {"철도운영기관명": "코레일", "선명": "경의중앙", "역명": name, "역간거리": km}
        for name, km in (("라온", 0), ("마루", 1.8), ("바다", 1.8), ("사랑", 1.8))
    ])
    write_csv(raw / "transfers.csv", ["연번", "호선", "환승역명", "환승노선", "환승거리", "환승소요시간"], [
        {"연번": 1, "호선": "2", "환승역명": "라온", "환승노선": "경의중앙선", "환승거리": 120, "환승소요시간": "01:40"},
    ])


def _write_manual(manual: Path) -> None:
    write_csv(manual / "line_orders.csv", ["line", "seq", "name"], [
        {"line": "우이신설선", "seq": i, "name": name} for i, name in enumerate(("사랑", "아라", "자람", "차오름"), start=1)
    ])
    write_csv(manual / "line_classes.csv", ["line", "line_class"], [
        {"line": "2호선", "line_class": "urban"},
        {"line": "경의중앙선", "line_class": "regional"},
        {"line": "우이신설선", "line_class": "urban"},
    ])
    write_csv(manual / "station_aliases.csv", ["a", "b"], [])


def _patch(monkeypatch, name: str, value) -> None:
    for module in PATCHED_MODULES:
        if hasattr(module, name):
            monkeypatch.setattr(module, name, value)


@pytest.fixture
def world(tmp_path: Path, monkeypatch) -> tuple[Path, Path]:
    raw, manual, out = tmp_path / "raw", tmp_path / "manual", tmp_path / "out"
    for d in (raw, manual, out):
        d.mkdir()
    _write_raw(raw)
    _write_manual(manual)
    for name, value in {
        "RAW_DIR": raw,
        "MANUAL_DIR": manual,
        "OUT_DIR": out,
        "RAW_FILES": {
            "stations_std": RawFile("std.xlsx", "https://example.invalid/std"),
            "seoul_times": RawFile("seoul_times.csv", "https://example.invalid/seoul"),
            "transfers": RawFile("transfers.csv", "https://example.invalid/transfers"),
        },
        "KRAIL_KM_DIRECTION": {KRAIL_FILE: "from_prev"},
        "SEGMENT_PATCHES": {},
        "EXPECTED_KM_DROPS": frozenset(),
        "EDGE_LENGTH_ALLOWLIST": frozenset(),
        "STD_LINE_OVERRIDES": {},
        "STD_COORD_OVERRIDES": {},
        "KRAIL_EXCLUDE": frozenset(),
        "KRAIL_OUT_OF_AREA": frozenset(),
        "SANITY_CASES": [("가람", "사랑", 1, 120)],
    }.items():
        _patch(monkeypatch, name, value)
    return manual, out


def test_run_all_end_to_end_on_synthetic_sources(world: tuple[Path, Path]):
    manual, out = world
    run_all.run_stations()
    run_all.run_edges()
    run_all.run_groups()
    group_id = {g["name"]: int(g["id"]) for g in read_csv_rows(out / "station_groups.csv")}
    write_csv(manual / "hubs.csv", ["group_id", "name", "region", "tags", "themes", "vibe_summary"], [
        {"group_id": group_id["가람"], "name": "가람", "region": "서울", "tags": "교통요지", "themes": "food", "vibe_summary": "합성 거점"},
        {"group_id": group_id["사랑"], "name": "사랑", "region": "서울", "tags": "환승;골목", "themes": "", "vibe_summary": "합성 환승 거점"},
    ])

    assert run_all.main() == 0

    station_rows = read_csv_rows(out / "stations.csv")
    assert len(station_rows) == 12
    assert len(group_id) == 10
    edge_rows = read_csv_rows(out / "edges.csv")
    assert len(edge_rows) == 9
    assert sum(1 for e in edge_rows if e["source"] == "measured") == 3
    transfers = read_csv_rows(out / "transfers.csv")
    assert sorted(t["source"] for t in transfers) == ["default", "measured"]
    hub_nodes = [s for s in station_rows if int(s["group_id"]) in {group_id["가람"], group_id["사랑"]}]
    assert len(hub_nodes) == 3
    assert len(read_csv_rows(out / "station_times.csv")) == 12 * len(hub_nodes)

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    counts = load_all(engine, out, manual)
    assert counts["stations"] == 12 and counts["hubs"] == 2
    assert counts["station_times"] == 36
