import httpx

from app.errors import UpstreamError


def json_object(response: httpx.Response, source: str) -> dict:
    """외부 API는 오류를 200과 HTML이나 XML 본문으로 돌려주기도 한다. 그때는 UpstreamError로 바꾼다."""
    try:
        payload = response.json()
    except ValueError as exc:
        raise UpstreamError(f"{source}: non-json response") from exc
    if not isinstance(payload, dict):
        raise UpstreamError(f"{source}: unexpected response shape")
    return payload
