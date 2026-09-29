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


def test_analyze_rejects_oversized_upload(client, monkeypatch):
    monkeypatch.setattr(analyses_api, "_MAX_UPLOAD_BYTES", 10)
    r = client.post(
        "/api/analyze",
        data={"task": "flood"},
        files={"file": ("a.tif", b"x" * 11, "image/tiff")},
    )
    assert r.status_code == 413


class _RaisingSegmenter:
    def __init__(self, exc: Exception) -> None:
        self.exc = exc

    def segment(self, geotiff, task):
        raise self.exc


@pytest.mark.parametrize(
    ("exc", "status"),
    [
        (OSError("not a TIFF"), 422),
        (ValueError("bandas incorrectas"), 422),
        (MemoryError(), 413),
        (RuntimeError("CUDA out of memory"), 503),
        (ImportError("no torch"), 503),
        (TypeError("Does not validate"), 503),
    ],
)
def test_analyze_maps_segmenter_errors(tmp_path: Path, exc, status):
    repo = FileAnalysisRepository(tmp_path / "analyses")
    use_case = AnalyzeUseCase(_RaisingSegmenter(exc), repo)
    app.dependency_overrides[analyses_api.get_use_case] = lambda: use_case
    try:
        r = TestClient(app).post(
            "/api/analyze",
            data={"task": "flood"},
            files={"file": ("a.tif", b"x", "image/tiff")},
        )
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == status, r.text


def test_missing_analysis_404(client):
    assert client.get("/api/analyses/nope").status_code == 404
    assert client.get("/api/analyses/nope/mask_png").status_code == 404


def test_examples_lists_official_scenes(client):
    r = client.get("/api/examples")
    assert r.status_code == 200
    body = r.json()
    assert {s["id"] for s in body} == {"india", "spain", "usa", "t10seh", "t10sff", "t10sgf"}
    assert {s["task"] for s in body} == {"flood", "burn_scar"}


def test_analyze_unknown_example_404(client):
    assert client.post("/api/examples/nope/analyze").status_code == 404


def test_analyze_example_uses_cached_file(client, tmp_path, monkeypatch):
    dest = tmp_path / "India_900498_S2Hand.tif"
    dest.write_bytes(b"fake-tif")

    def fake_fetch(scene, dest_dir):
        assert scene.id == "india"
        dest_dir.mkdir(parents=True, exist_ok=True)
        out = dest_dir / scene.filename
        out.write_bytes(b"fake-tif")
        return out

    monkeypatch.setattr(analyses_api, "fetch", fake_fetch)
    monkeypatch.setattr(
        analyses_api, "get_settings", lambda: type("S", (), {"tune_artifacts_dir": tmp_path})()
    )
    r = client.post("/api/examples/india/analyze")
    assert r.status_code == 201, r.text
    assert r.json()["input_filename"] == "India_900498_S2Hand.tif"
    assert r.json()["task"] == "flood"


def _post(client, name: str, task: str = "flood"):
    r = client.post(
        "/api/analyze",
        data={"task": task},
        files={"file": (name, b"fake-bytes", "image/tiff")},
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_timeline_groups_the_same_box_oldest_first(client):
    first = _post(client, "old.tif", "burn_scar")
    second = _post(client, "new.tif", "flood")
    r = client.get("/api/timeline", params={"analysis_id": second["id"]})
    assert r.status_code == 200
    assert [a["id"] for a in r.json()] == [first["id"], second["id"]]

    inside = client.get("/api/timeline", params={"lat": 4.05, "lon": -74.95})
    assert [a["id"] for a in inside.json()] == [first["id"], second["id"]]
    assert client.get("/api/timeline", params={"lat": 0, "lon": 0}).json() == []
    floods = client.get("/api/timeline", params={"analysis_id": first["id"], "task": "flood"})
    assert [a["id"] for a in floods.json()] == [second["id"]]


def test_analyses_can_be_filtered_by_coordinate(client):
    body = _post(client, "scene.tif")
    inside = client.get("/api/analyses", params={"lat": 4.05, "lon": -74.95})
    assert inside.status_code == 200
    assert [a["id"] for a in inside.json()] == [body["id"]]
    assert client.get("/api/analyses", params={"lat": 0, "lon": 0}).json() == []
    assert client.get("/api/analyses", params={"lat": 91, "lon": 0}).status_code == 422
    assert client.get("/api/analyses", params={"lat": 4.05}).status_code == 422


def test_timeline_rejects_a_missing_anchor_or_no_place(client):
    assert client.get("/api/timeline", params={"analysis_id": "nope"}).status_code == 404
    assert client.get("/api/timeline").status_code == 422
    assert client.get("/api/timeline", params={"lat": 4}).status_code == 422


def test_forecast_returns_the_outlook_and_503_when_it_fails(client, monkeypatch):
    monkeypatch.setattr(
        analyses_api,
        "flood_outlook",
        lambda lat, lon: {
            "task": "flood",
            "source": "GloFAS v4 (Open-Meteo)",
            "note": "prueba",
            "cell": {"lat": lat, "lon": lon},
            "horizon_days": 1,
            "probability": 0.2,
            "level": None,
            "threshold": 10.0,
            "threshold_unit": "m³/s",
            "daily": [{"date": "2026-09-29", "probability": 0.2, "value": None, "level": None}],
        },
    )
    ok = client.get("/api/forecast", params={"task": "flood", "lat": 4.6, "lon": -74.1})
    assert ok.status_code == 200
    assert ok.json()["probability"] == 0.2

    def down(lat, lon):
        raise analyses_api.ForecastError("caído")

    monkeypatch.setattr(analyses_api, "flood_outlook", down)
    assert (
        client.get("/api/forecast", params={"task": "flood", "lat": 4.6, "lon": -74.1}).status_code
        == 503
    )
    assert (
        client.get("/api/forecast", params={"task": "flood", "lat": 91, "lon": 0}).status_code
        == 422
    )
