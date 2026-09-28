import re

_PAREN = re.compile(r"\([^)]*\)|（[^）]*）")
_SPACES = re.compile(r"[\s\u3000]+")


def normalize_station_name(raw: str) -> str:
    """괄호와 내용 제거, 공백 제거, 끝의 '역' 제거. 원문은 호출자가 따로 보존한다."""
    s = _PAREN.sub("", raw)
    s = _SPACES.sub("", s)
    if len(s) > 1 and s.endswith("역"):
        s = s[:-1]
    return s
