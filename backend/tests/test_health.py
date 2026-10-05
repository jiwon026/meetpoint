from fastapi.testclient import TestClient

from app.main import create_app


def test_health_returns_ok():
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_health_answers_head_for_uptime_monitors():
    # 무료 요금제의 가동 감시는 HEAD로 확인한다.
    client = TestClient(create_app())
    assert client.head("/health").status_code == 200
