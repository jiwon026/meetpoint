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
