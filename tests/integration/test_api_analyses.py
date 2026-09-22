"""Router /api con segmentador falso inyectado (sin torch)."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tests.unit.test_analyze import FakeSegmenter, fake_output
from tune.application.analyze import AnalyzeUseCase
from tune.infrastructure.analyses import FileAnalysisRepository
from tune.interfaces.api import analyses as analyses_api
from tune.interfaces.api.main import app

pytestmark = pytest.mark.integration


@pytest.fixture
def client(tmp_path: Path):
    repo = FileAnalysisRepository(tmp_path / "analyses")
    use_case = AnalyzeUseCase(FakeSegmenter(fake_output()), repo)
    app.dependency_overrides[analyses_api.get_use_case] = lambda: use_case
    app.dependency_overrides[analyses_api.get_repository] = lambda: repo
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_tasks_lists_both_models(client):
    r = client.get("/api/tasks")
    assert r.status_code == 200
    ids = {t["id"] for t in r.json()}
    assert ids == {"flood", "burn_scar"}
    assert all(t["model_id"].startswith("ibm-nasa-geospatial/") for t in r.json())


def test_analyze_then_fetch_and_download(client):
    r = client.post(
        "/api/analyze",
        data={"task": "flood"},
        files={"file": ("scene.tif", b"fake-bytes", "image/tiff")},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["task"] == "flood"
    assert body["affected_ratio"] > 0
    assert body["bounds"]["west"] == -75.0
    assert body["artifacts"]["mask_png"] == f"/api/analyses/{body['id']}/mask_png"

    assert client.get(f"/api/analyses/{body['id']}").json()["id"] == body["id"]
    assert [a["id"] for a in client.get("/api/analyses").json()] == [body["id"]]

    png = client.get(body["artifacts"]["mask_png"])
    assert png.status_code == 200
    assert png.headers["content-type"] == "image/png"
    assert png.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_analyze_rejects_non_tif(client):
    r = client.post(
        "/api/analyze", data={"task": "flood"}, files={"file": ("a.png", b"x", "image/png")}
    )
    assert r.status_code == 400


def test_analyze_rejects_unknown_task(client):
    r = client.post(
        "/api/analyze", data={"task": "volcano"}, files={"file": ("a.tif", b"x", "image/tiff")}
    )
    assert r.status_code == 422


def test_missing_analysis_404(client):
    assert client.get("/api/analyses/nope").status_code == 404
    assert client.get("/api/analyses/nope/mask_png").status_code == 404
