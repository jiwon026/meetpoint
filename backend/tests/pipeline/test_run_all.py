from pipeline import run_all


def test_run_all_stops_when_validate_fails(monkeypatch):
    calls: list[str] = []
    for name in ("stations", "edges", "groups", "times"):
        monkeypatch.setattr(run_all, f"run_{name}", lambda n=name: calls.append(n))
    monkeypatch.setattr(run_all, "run_validate", lambda: ["문제"])
    assert run_all.main() == 1
    assert calls == ["stations", "edges", "groups", "times"]


def test_run_all_returns_zero_when_clean(monkeypatch):
    for name in ("stations", "edges", "groups", "times"):
        monkeypatch.setattr(run_all, f"run_{name}", lambda: None)
    monkeypatch.setattr(run_all, "run_validate", lambda: [])
    assert run_all.main() == 0
