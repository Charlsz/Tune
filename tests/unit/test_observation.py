"""Observación STAC (GFM / OPERA) sin red."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from tune.domain.analysis import GeoBounds, HazardTask, ObservationLayer, RasterGrid
from tune.infrastructure.observation.stac import (
    CompositeObservationProvider,
    StacObservationProvider,
)
from tune.infrastructure.reference.errors import ReferenceUnavailable


def _grid() -> RasterGrid:
    return RasterGrid(
        crs="EPSG:4326",
        transform=(0.01, 0.0, -1.0, 0.0, -0.01, 40.0),
        width=4,
        height=3,
    )


def test_observe_skips_opera_without_token(tmp_path: Path) -> None:
    provider = StacObservationProvider("opera_dswx_s1", tmp_path, token=None)
    assert provider.observe(HazardTask.FLOOD, _grid(), acquired_at="2024-10-30") is None


def test_observe_skips_burn_scar(tmp_path: Path) -> None:
    provider = StacObservationProvider("gfm", tmp_path)
    assert provider.observe(HazardTask.BURN_SCAR, _grid()) is None


def test_observe_reads_window_and_caches(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    provider = StacObservationProvider("gfm", tmp_path)
    calls = {"search": 0, "read": 0}

    class FakeAsset:
        href = "https://example.test/flood.tif"

    class FakeItem:
        id = "ENSEMBLE_FLOOD_test"
        assets = {"ensemble_flood_extent": FakeAsset()}
        properties = {"datetime": "2024-11-01T12:00:00Z"}
        datetime = None

    def fake_search(bounds, day):
        calls["search"] += 1
        return FakeItem()

    def fake_read(href, bounds):
        calls["read"] += 1
        arr = np.array([[1, 0, 255, 1], [0, 1, 0, 255], [1, 1, 0, 0]], dtype=np.uint8)
        import rasterio

        tf = rasterio.transform.from_bounds(
            bounds.west, bounds.south, bounds.east, bounds.north, 4, 3
        )
        return arr, tf, "EPSG:4326", 255

    monkeypatch.setattr(provider, "_search", fake_search)
    monkeypatch.setattr(provider, "_read_window", fake_read)
    layer = provider.observe(HazardTask.FLOOD, _grid(), acquired_at="2024-11-01")
    assert layer is not None
    assert layer.source == "gfm"
    assert layer.mask.any()
    assert calls == {"search": 1, "read": 1}
    # Segunda llamada: caché
    layer2 = provider.observe(HazardTask.FLOOD, _grid(), acquired_at="2024-11-01")
    assert layer2 is not None
    assert calls["search"] == 1
    assert calls["read"] == 1


def test_composite_keeps_going_after_unavailable(tmp_path: Path) -> None:
    class Boom:
        def observe(self, task, grid, *, acquired_at=None):
            raise ReferenceUnavailable("caído")

    class Ok:
        def observe(self, task, grid, *, acquired_at=None):
            return ObservationLayer(
                mask=np.ones((3, 4), dtype=bool),
                valid=np.ones((3, 4), dtype=bool),
                source="gfm",
            )

    found = CompositeObservationProvider([Boom(), Ok()]).observe(  # type: ignore[arg-type]
        HazardTask.FLOOD, _grid(), acquired_at="2024-01-01"
    )
    assert len(found) == 1
    assert found[0].source == "gfm"


def test_unknown_preset_raises() -> None:
    with pytest.raises(ValueError, match="preset"):
        StacObservationProvider("nope", Path("."))


def test_gfm_preset_points_at_eodc() -> None:
    from tune.infrastructure.observation.stac import PRESETS

    assert PRESETS["gfm"]["collection"] == "GFM"
    assert PRESETS["gfm"]["stac_url"].startswith("https://stac.eodc.eu")
    _ = GeoBounds
