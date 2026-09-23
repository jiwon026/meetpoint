from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.geocoding.kakao import Geocoder, KakaoGeocoder
from app.models import Hub, Station
from app.transit.matrix import StationTimeMatrix


def get_geocoder() -> Geocoder:
    return KakaoGeocoder(get_settings().kakao_rest_key)


def hub_node_ids(session: Session) -> set[int]:
    """거점과 같은 이름을 가진 모든 역 노드 id. 환승역은 노선별로 노드가 따로 있다."""
    hub_names = set(session.scalars(select(Hub.name)).all())
    stmt = select(Station.id).where(Station.name.in_(hub_names))
    return set(session.scalars(stmt).all())


_matrix_holder: dict[str, StationTimeMatrix] = {}


def get_matrix(session: Session = Depends(get_db)) -> StationTimeMatrix:
    """시간표는 정적 데이터라 프로세스당 한 번만 읽는다. 데이터 갱신 후에는 재시작한다."""
    matrix = _matrix_holder.get("matrix")
    if matrix is None:
        matrix = StationTimeMatrix.load(session, hub_node_ids(session))
        _matrix_holder["matrix"] = matrix
    return matrix
