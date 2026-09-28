import re

_PAREN = re.compile(r"\([^)]*\)|（[^）]*）")
_SPACES = re.compile(r"[\s\u3000]+")
# 가운데 점 계열(U+00B7, U+2024, U+2027, U+30FB)은 원본마다 표기가 달라 마침표로 맞춘다.
_DOTS = re.compile(r"[\u00b7\u2024\u2027\u30fb]")


def normalize_station_name(raw: str) -> str:
    """괄호와 내용 제거, 공백 제거, 가운데 점을 마침표로, 끝의 '역' 제거. 원문은 호출자가 따로 보존한다."""
    s = _PAREN.sub("", raw)
    s = _SPACES.sub("", s)
    s = _DOTS.sub(".", s)
    if len(s) > 1 and s.endswith("역"):
        s = s[:-1]
    return s
