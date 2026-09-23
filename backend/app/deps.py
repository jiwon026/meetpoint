import logging

import httpx
from fastapi import Depends
from sqlalchemy.orm import Session

from app.cache import ContentCacheRepo
from app.config import get_settings
from app.db import get_db
from app.events.kopis import KopisClient
from app.events.seoul import SeoulEventClient
from app.geocoding.kakao import Geocoder, KakaoGeocoder
from app.hubs import hub_node_ids
from app.places.kakao_local import KakaoLocalClient
from app.transit.matrix import StationTimeMatrix

logger = logging.getLogger(__name__)

_http_client = httpx.Client(timeout=10.0)


def get_http_client() -> httpx.Client:
    return _http_client


def get_geocoder() -> Geocoder:
    return KakaoGeocoder(get_settings().kakao_rest_key, client=get_http_client())


_matrix_holder: dict[str, StationTimeMatrix] = {}


def get_matrix(session: Session = Depends(get_db)) -> StationTimeMatrix:
    """시간표는 정적 데이터라 프로세스당 한 번만 읽는다. 데이터 갱신 후에는 재시작한다."""
    matrix = _matrix_holder.get("matrix")
    if matrix is not None:
        return matrix
    matrix = StationTimeMatrix.load(session, hub_node_ids(session))
    if len(matrix) == 0:
        # 데이터 적재 전에 들어온 요청이다. 빈 행렬을 캐시하면 적재 후에도 계속 빈 값을 돌려준다.
        logger.warning("station_times is empty; matrix not cached")
        return matrix
    _matrix_holder["matrix"] = matrix
    return matrix


def reset_matrix_cache() -> None:
    _matrix_holder.clear()


def get_local_client() -> KakaoLocalClient:
    return KakaoLocalClient(get_settings().kakao_rest_key, client=get_http_client())


def get_seoul_client() -> SeoulEventClient:
    return SeoulEventClient(get_settings().seoul_api_key, client=get_http_client())


def get_kopis_client() -> KopisClient:
    return KopisClient(get_settings().kopis_api_key, client=get_http_client())


def get_cache(session: Session = Depends(get_db)) -> ContentCacheRepo:
    return ContentCacheRepo(session)
