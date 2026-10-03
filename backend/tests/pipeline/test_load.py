from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.hubs import load_hub_candidates
from app.models import Base, ContentCache, Hub, Station, StationTime
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
    write_csv(manual / "hubs.csv", ["group_id", "name", "region", "tags", "themes", "vibe_summary"], [
        {"group_id": 1, "name": "홍대입구", "region": "서울", "tags": "밤늦게까지;20대", "themes": "drink;play", "vibe_summary": "밤늦게까지 북적이는 젊은 동네"},
        {"group_id": 2, "name": "강남", "region": "서울", "tags": "교통요지", "themes": "", "vibe_summary": "어디서든 오기 쉬운 교통 중심"},
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
        assert hub.themes == ["drink", "play"]
        assert s.scalar(select(Hub).where(Hub.name == "강남")).themes == []
        assert s.get(StationTime, (2, 3)).minutes == 38
        assert s.get(Station, 2).group_id == 1
        _, candidates = load_hub_candidates(s)
        assert {c.name: set(c.node_ids) for c in candidates} == {"홍대입구": {1, 2}, "강남": {3}}


def _fk_engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(eng, "connect")
    def _enable_fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    return eng


def test_load_all_clears_hub_scoped_content_cache(tmp_path: Path):
    out, manual = tmp_path / "out", tmp_path / "manual"
    out.mkdir(); manual.mkdir()
    _write_outputs(out, manual)
    eng = _fk_engine()
    load_all(eng, out, manual)
    with Session(eng) as s:
        s.add_all([
            ContentCache(hub_id=1, kind="food", cache_key="places:1:food", payload=[], fetched_at=datetime(2026, 9, 1)),
            ContentCache(hub_id=None, kind="events", cache_key="events:seoul:raw", payload=[], fetched_at=datetime(2026, 9, 1)),
        ])
        s.commit()
    load_all(eng, out, manual)
    with Session(eng) as s:
        keys = set(s.scalars(select(ContentCache.cache_key)))
    assert keys == {"events:seoul:raw"}
