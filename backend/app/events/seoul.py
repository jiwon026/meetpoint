import httpx

from app.errors import UpstreamError
from app.http_json import json_object

SEOUL_OPENAPI_BASE = "http://openapi.seoul.go.kr:8088"
PAGE_SIZE = 1000
MAX_PAGES = 10
SUCCESS_CODE = "INFO-000"
NO_DATA_CODE = "INFO-200"


def _rows_or_raise(payload: dict) -> list[dict]:
    body = payload.get("culturalEventInfo")
    result = (body if body is not None else payload).get("RESULT", {}) or {}
    code = result.get("CODE", "")
    if body is None:
        if code == NO_DATA_CODE:
            return []
        raise UpstreamError(f"seoul api: {code} {result.get('MESSAGE', '')}".strip())
    if code and code != SUCCESS_CODE:
        raise UpstreamError(f"seoul api: {code} {result.get('MESSAGE', '')}".strip())
    return list(body.get("row", []))


class SeoulEventClient:
    """서울시 문화행사 정보(culturalEventInfo)를 전부 가져온다. 페이지는 1부터 1000 단위."""

    def __init__(self, api_key: str, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=10.0)
        self._api_key = api_key

    def fetch_all(self) -> list[dict]:
        rows: list[dict] = []
        for page in range(MAX_PAGES):
            start = page * PAGE_SIZE + 1
            end = start + PAGE_SIZE - 1
            url = f"{SEOUL_OPENAPI_BASE}/{self._api_key}/json/culturalEventInfo/{start}/{end}/"
            response = self._client.get(url)
            response.raise_for_status()
            batch = _rows_or_raise(json_object(response, "seoul api"))
            rows.extend(batch)
            if len(batch) < PAGE_SIZE:
                break
        return rows
