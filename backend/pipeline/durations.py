def parse_duration(value: str | None) -> float | None:
    """'2', '1.5', '02:00', '01:30' 을 분(float)으로. 빈 값이나 이상한 값은 None.

    서울교통공사 파일의 소요시간과 환승소요시간은 mm:ss 형식이다.
    """
    value = (value or "").strip()
    if not value:
        return None
    if ":" in value:
        m, s = value.split(":", 1)
        try:
            return float(m) + float(s) / 60
        except ValueError:
            return None
    try:
        return float(value)
    except ValueError:
        return None
