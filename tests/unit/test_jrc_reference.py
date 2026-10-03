"""Referencia JRC Global Surface Water (sin red: monkeypatch)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from tune.domain.analysis import GeoBounds, HazardTask, RasterGrid, ReferenceLayer
from tune.infrastructure.reference.composite import CompositeReferenceProvider
from tune.infrastructure.reference.errors import ReferenceUnavailable
from tune.infrastructure.reference.jrc import JrcReferenceProvider, tile_name, tiles_for_bounds


def test_tile_name_colombia() -> None:
    assert tile_name(-74.1, 4.6) == "occurrence_80W_10Nv1_4_2021.tif"


def test_tile_name_on_northern_edge() -> None:
    assert tile_name(-80.0, 10.0) == "occurrence_80W_20Nv1_4_2021.tif"


def test_tile_name_southern_hemisphere() -> None:
    assert tile_name(-70.0, -3.0) == "occurrence_70W_0Sv1_4_2021.tif"
    assert tile_name(20.0, -15.0) == "occurrence_20E_10Sv1_4_2021.tif"


def test_tiles_for_bounds_crossing_edge() -> None:
    # Caja que cruza lon -70
    bounds = GeoBounds(west=-72.0, south=4.0, east=-68.0, north=5.0)
    names = tiles_for_bounds(bounds)
    assert len(names) >= 2
    assert any("80W" in n for n in names)
    assert any("70W" in n for n in names)


def test_jrc_threshold_and_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    provider = JrcReferenceProvider(tmp_path / "jrc", permanent_pct=75)
    calls = {"n": 0}

    def fake_read(url, bounds):
        calls["n"] += 1
        # 4x4: occurrence 80, 50, 0, nodata
        arr = np.array(
            [[80, 50, 0, 255], [90, 75, 10, 255], [100, 20, 0, 255], [60, 80, 0, 255]],
            dtype=np.uint8,
        )
        # transform identity-ish in WGS84
        import rasterio

        transform = rasterio.transform.from_bounds(
            bounds.west, bounds.south, bounds.east, bounds.north, 4, 4
        )
        return arr, transform, "EPSG:4326"

    monkeypatch.setattr(provider, "_read_window", fake_read)
    grid = RasterGrid(
        crs="EPSG:4326",
        transform=(0.01, 0.0, -75.0, 0.0, -0.01, 5.0),
        width=4,
        height=4,
    )
    layer = provider.reference(HazardTask.FLOOD, grid)
    assert layer is not None
    assert layer.source == "jrc_gsw_v1_4"
    assert calls["n"] == 1
    p = np.asarray(layer.mask)
    # Tras reproyectar nearest, píxeles ≥75 deben ser permanentes
    assert p.any()
    # Segunda llamada: caché
    layer2 = provider.reference(HazardTask.FLOOD, grid)
    assert layer2 is not None
    assert calls["n"] == 1


def test_jrc_ignores_burn_scar(tmp_path: Path) -> None:
    provider = JrcReferenceProvider(tmp_path)
    grid = RasterGrid(crs="EPSG:4326", transform=(0.01, 0, -75, 0, -0.01, 5), width=2, height=2)
    assert provider.reference(HazardTask.BURN_SCAR, grid) is None


def test_composite_falls_through() -> None:
    class A:
        def reference(self, task, grid, *, exclude_id=None):
            return None

    class B:
        def reference(self, task, grid, *, exclude_id=None):
            return ReferenceLayer(
                mask=np.zeros((2, 2), dtype=bool),
                valid=np.ones((2, 2), dtype=bool),
                source="history",
            )

    grid = RasterGrid(crs="EPSG:4326", transform=(1, 0, 0, 0, -1, 0), width=2, height=2)
    layer = CompositeReferenceProvider([A(), B()]).reference(HazardTask.FLOOD, grid)
    assert layer is not None
    assert layer.source == "history"


def test_composite_skips_unavailable() -> None:
    class Boom:
        def reference(self, task, grid, *, exclude_id=None):
            raise ReferenceUnavailable("caído")

    class Ok:
        def reference(self, task, grid, *, exclude_id=None):
            return ReferenceLayer(
                mask=np.ones((1, 1), dtype=bool),
                valid=np.ones((1, 1), dtype=bool),
                source="history",
            )

    grid = RasterGrid(crs="EPSG:4326", transform=(1, 0, 0, 0, -1, 0), width=1, height=1)
    layer = CompositeReferenceProvider([Boom(), Ok()]).reference(HazardTask.FLOOD, grid)
    assert layer is not None
    assert layer.source == "history"
