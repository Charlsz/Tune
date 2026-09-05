"""API en proceso con TestClient. No requiere MLflow: `/model` degrada a loaded=False."""

import pytest
from fastapi.testclient import TestClient

from tune import __version__
from tune.interfaces.api.main import app

pytestmark = pytest.mark.integration


@pytest.fixture
def client():
    return TestClient(app)


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "version": __version__}


def test_model_without_registry_reports_not_loaded(client):
    r = client.get("/model")
    assert r.status_code == 200
    body = r.json()
    assert body["loaded"] is False
    assert body["version"] is None


def test_predict_without_model_returns_503(client):
    r = client.post("/predict", files={"file": ("x.tif", b"bytes", "image/tiff")})
    assert r.status_code == 503
