import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.models import Base, Hub, Station, StationGroup, StationTime

# id, 이름, 노선, 위도, 경도
STATIONS = [
    (1, "홍대입구", "2호선", 37.5571, 126.9245),
    (2, "강남", "2호선", 37.4979, 127.0276),
    (3, "잠실", "2호선", 37.5133, 127.1001),
    (4, "건대입구", "2호선", 37.5404, 127.0693),
    (5, "신촌", "2호선", 37.5551, 126.9368),
    (6, "수원", "1호선", 37.2660, 126.9999),
]
STATION_BY_ID = {s[0]: s for s in STATIONS}

# id, station_id, 이름, 지역, 태그, 분위기 한 줄
HUBS = [
    (1, 1, "홍대입구", "서울", ["밤늦게까지", "20대"], "밤늦게까지 북적이는 젊은 동네"),
    (2, 2, "강남", "서울", ["교통요지", "회식"], "어디서든 오기 쉬운 교통 중심"),
    (3, 3, "잠실", "서울", ["롯데월드", "가족"], "놀이공원과 대형몰이 있는 동네"),
    (4, 4, "건대입구", "서울", ["먹자골목", "대학가"], "먹자골목이 큰 대학가"),
]

# (from, to): 분. 양방향으로 적재된다.
TIMES = {
    (1, 2): 35, (1, 3): 45, (1, 4): 30, (1, 5): 3,
    (2, 3): 15, (2, 4): 20, (2, 5): 33,
    (3, 4): 12, (3, 5): 43,
    (4, 5): 28,
    (6, 1): 80, (6, 2): 60, (6, 3): 70, (6, 4): 75, (6, 5): 78,
}


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def session(engine):
    with Session(engine, expire_on_commit=False) as s:
        yield s


@pytest.fixture
def seeded(session):
    session.add_all(
        [StationGroup(id=i, name=n, lat=la, lng=lo) for i, n, l, la, lo in STATIONS]
    )
    session.flush()
    session.add_all(
        [Station(id=i, name=n, line=l, lat=la, lng=lo, group_id=i) for i, n, l, la, lo in STATIONS]
    )
    session.add_all(
        [
            Hub(
                id=i,
                station_id=sid,
                group_id=sid,
                name=n,
                lat=STATION_BY_ID[sid][3],
                lng=STATION_BY_ID[sid][4],
                region=r,
                tags=t,
                vibe_summary=v,
            )
            for i, sid, n, r, t, v in HUBS
        ]
    )
    rows = []
    for (a, b), m in TIMES.items():
        rows.append(StationTime(from_station_id=a, to_station_id=b, minutes=m))
        rows.append(StationTime(from_station_id=b, to_station_id=a, minutes=m))
    for i, *_ in STATIONS:
        rows.append(StationTime(from_station_id=i, to_station_id=i, minutes=0))
    session.add_all(rows)
    session.commit()
    return session
