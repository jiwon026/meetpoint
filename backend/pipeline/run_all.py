"""stations -> edges -> groups -> times -> validate 를 순서대로 실행한다. load는 따로 실행한다.

실행: python -m pipeline.run_all
"""

import sys

from pipeline import edges, groups, stations, times, validate


def run_stations() -> None:
    stations.main()


def run_edges() -> None:
    edges.main()


def run_groups() -> None:
    groups.main()


def run_times() -> None:
    times.main()


def run_validate() -> list[str]:
    return validate.run_all_checks()


def main() -> int:
    run_stations()
    run_edges()
    run_groups()
    run_times()
    problems = run_validate()
    for p in problems[:200]:
        print("FAIL:", p)
    if problems:
        print(f"검증 실패 {len(problems)}건")
        return 1
    print("검증 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main())
