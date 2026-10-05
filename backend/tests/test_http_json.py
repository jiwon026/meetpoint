import httpx
import pytest

from app.errors import UpstreamError
from app.http_json import json_object


def test_json_object_returns_dict():
    assert json_object(httpx.Response(200, json={"a": 1}), "x") == {"a": 1}


@pytest.mark.parametrize("response", [
    httpx.Response(200, text="<html>error</html>"),
    httpx.Response(200, text=""),
    httpx.Response(200, json=[1, 2]),
])
def test_json_object_raises_upstream_error(response):
    with pytest.raises(UpstreamError, match="^x: "):
        json_object(response, "x")
