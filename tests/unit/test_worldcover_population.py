"""Tiles de WorldCover y GHSL, más caché, sin red."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from tune.domain.analysis import GeoBounds, RasterGrid
from tune.infrastructure.exposure.population import GhslPopulationProvider, tile_rc
from tune.infrastructure.exposure.worldcover import WorldCoverProvider, tile_id, tiles_for_bounds


def test_worldcover_tile_id() -> None:
    assert tile_id(-74.1, 4.6) == "N03W075"
    assert tile_id(-75.0, 9.0) == "N09W075"
    assert tile_id(12.1, -3.2) == "S06E012"


def test_worldcover_tiles_crossing_edge() -> None:
    bounds = GeoBounds(west=-76.0, south=8.5, east=-73.5, north=10.2)
    names = tiles_for_bounds(bounds)
    assert len(names) >= 2
    assert any(n.startswith("N09") for n in names)
    assert any("W075" in n for n in names)


def test_ghsl_tile_rc_matches_known_tile() -> None:
    # R9C11 cubre ~[-80,-70] × [-0.9, 9.1]; un punto de La Mojana cae ahí.
    assert tile_rc(-74.65, 8.85) == (8, 11) or tile_rc(-74.65, 8.85)[1] == 11
    row, col = tile_rc(-74.65, 8.85)
    assert col == 11
    assert row in {8, 9}


def test_worldcover_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    provider = WorldCoverProvider(tmp_path)
    calls = {"n": 0}

    def fake_read(href, bounds):
        calls["n"] += 1
        arr = np.array([[40, 50], [10, 80]], dtype=np.uint8)
        import rasterio

        tf = rasterio.transform.from_bounds(
            bounds.west, bounds.south, bounds.east, bounds.north, 2, 2
        )
        return arr, tf, "EPSG:4326", 0

    monkeypatch.setattr(provider, "_read_window", fake_read)
    grid = RasterGrid(
        crs="EPSG:4326", transform=(0.01, 0.0, -75.0, 0.0, -0.01, 5.0), width=2, height=2
    )
    data, valid = provider.landcover(grid)
    assert data.shape == (2, 2)
    assert valid.any()
    provider.landcover(grid)
    assert calls["n"] == 1


def test_ghsl_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    provider = GhslPopulationProvider(tmp_path)
    calls = {"n": 0}

    def fake_read(href, bounds):
        calls["n"] += 1
        arr = np.array([[1.5, 0.0], [3.0, -1.0]], dtype=np.float32)
        import rasterio

        tf = rasterio.transform.from_bounds(
            bounds.west, bounds.south, bounds.east, bounds.north, 2, 2
        )
        return arr, tf, "EPSG:4326", -200

    monkeypatch.setattr(provider, "_read_window", fake_read)
    grid = RasterGrid(
        crs="EPSG:4326", transform=(0.01, 0.0, -75.0, 0.0, -0.01, 5.0), width=2, height=2
    )
    pop, valid = provider.population(grid)
    assert pop.shape == (2, 2)
    assert valid.any()
    provider.population(grid)
    assert calls["n"] == 1
