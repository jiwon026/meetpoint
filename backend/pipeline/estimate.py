"""역간 거리(km)로 소요시간(분)을 추정한다. 실측이 있는 1~8호선으로 도시철도 속도를 보정할 수 있다.

실행: python -m pipeline.estimate --calibrate
"""

import sys

from pipeline.config import COLUMNS, DWELL_MIN, SPEED_KMH
from pipeline.durations import parse_duration
from pipeline.io import pick, read_csv_rows, require_raw


def estimate_minutes(km: float, line_class: str) -> float:
    speed = SPEED_KMH[line_class]
    return max(1.0, round(km / speed * 60 + DWELL_MIN, 1))


def calibrate_speed(pairs: list[tuple[float, float]]) -> float:
    """(km, 분) 쌍에서 원점을 지나는 최소제곱: 분 = km * (60 / 속도).

    서울교통공사 소요시간은 정차를 뺀 운행시간이라(2호선 잠실~강남 6구간 합 8.5분) 정차시간을 빼지 않는다.
    """
    usable = [(km, m) for km, m in pairs if km > 0 and m > 0]
    sxx = sum(km * km for km, _ in usable)
    sxy = sum(km * m for km, m in usable)
    slope = sxy / sxx
    return 60.0 / slope


def _measured_pairs() -> list[tuple[float, float]]:
    cols = COLUMNS["seoul"]
    pairs = []
    for row in read_csv_rows(require_raw("seoul_times")):
        try:
            km = float(pick(row, cols["km"]) or 0)
        except ValueError:
            continue
        minutes = parse_duration(pick(row, cols["minutes"]))
        if minutes is not None:
            pairs.append((km, minutes))
    return pairs


if __name__ == "__main__":
    if "--calibrate" in sys.argv:
        speed = calibrate_speed(_measured_pairs())
        print(f"1~8호선 실측 기준 urban 속도: {speed:.1f} km/h (config: {SPEED_KMH['urban']})")
        gap = abs(speed - SPEED_KMH["urban"]) / SPEED_KMH["urban"]
        print("15% 넘게 차이" if gap > 0.15 else "15% 이내, 상수 유지")
