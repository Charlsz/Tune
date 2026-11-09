"""Sirve el frontend detrás de la API cuando ``TUNE_WEB_DIST`` está definido."""

from __future__ import annotations

import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.integration

WEB_DIST = Path(__file__).resolve().parents[2] / "web" / "dist"


@pytest.fixture
def spa_client(tmp_path, monkeypatch):
    if not (WEB_DIST / "index.html").is_file():
        pytest.skip("web/dist no construido; corre npm run build en web/")

    # Recargar el módulo con TUNE_WEB_DIST para registrar rutas SPA.
    monkeypatch.setenv("TUNE_WEB_DIST", str(WEB_DIST))
    monkeypatch.setenv("TUNE_CORS_ORIGINS", "*")
    import tune.interfaces.api.main as main_mod

    importlib.reload(main_mod)
    client = TestClient(main_mod.app)
    yield client
    monkeypatch.delenv("TUNE_WEB_DIST", raising=False)
    importlib.reload(main_mod)


def test_spa_index_and_health(spa_client):
    h = spa_client.get("/health")
    assert h.status_code == 200
    assert h.json()["status"] == "ok"

    r = spa_client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")
    assert "<!DOCTYPE html>" in r.text or "<html" in r.text.lower()


def test_api_still_works_with_spa(spa_client):
    r = spa_client.get("/api/tasks")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
