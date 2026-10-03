import xml.etree.ElementTree as ET
from datetime import date

import httpx

from app.errors import UpstreamError

KOPIS_BASE = "http://www.kopis.or.kr/openApi/restful"
LIST_ROWS = 100
SUCCESS_CODE = "00"
LIST_FIELDS = ("mt20id", "prfnm", "fcltynm", "prfpdfrom", "prfpdto", "poster", "genrenm", "mt10id")
FACILITY_FIELDS = ("mt10id", "fcltynm", "la", "lo")


def _rows(xml_text: str, fields: tuple[str, ...]) -> list[dict]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise UpstreamError("kopis api: unparseable response") from exc
    # 인증키 오류 같은 실패는 200과 함께 <db><returncode>02</returncode>... 로 온다. 정상 응답에는 returncode가 없다.
    code = (root.findtext("db/returncode") or "").strip()
    if code and code != SUCCESS_CODE:
        raise UpstreamError(f"kopis api: returncode {code}")
    return [{f: (db.findtext(f) or "").strip() for f in fields} for db in root.findall("db")]


class KopisClient:
    def __init__(self, api_key: str, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=10.0)
        self._api_key = api_key

    def list_performances(self, meet_date: date, area_code: str) -> list[dict]:
        ymd = meet_date.strftime("%Y%m%d")
        response = self._client.get(
            f"{KOPIS_BASE}/pblprfr",
            params={
                "service": self._api_key,
                "stdate": ymd,
                "eddate": ymd,
                "cpage": 1,
                "rows": LIST_ROWS,
                "signgucode": area_code,
            },
        )
        response.raise_for_status()
        return _rows(response.text, LIST_FIELDS)

    def facility(self, mt10id: str) -> dict:
        response = self._client.get(f"{KOPIS_BASE}/prfplc/{mt10id}", params={"service": self._api_key})
        response.raise_for_status()
        rows = _rows(response.text, FACILITY_FIELDS)
        return rows[0] if rows else {}
