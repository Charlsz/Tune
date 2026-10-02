"""Reproyección de máscaras a una grilla común."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

rasterio = pytest.importorskip("rasterio")
from rasterio.transform import from_origin

from tune.domain.analysis import RasterGrid
from tune.infrastructure.raster.grid import bounds_wgs84, grid_from_meta, reproject_mask


def _write_mask(path: Path, data: np.ndarray, *, res: float, west: float, north: float) -> None:
    transform = from_origin(west, north, res, res)
    profile = {
        "driver": "GTiff",
        "height": data.shape[0],
        "width": data.shape[1],
        "count": 1,
        "dtype": "uint8",
        "crs": "EPSG:32618",
        "transform": transform,
        "nodata": 255,
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(data, 1)


def test_grid_from_meta_and_bounds(tmp_path: Path) -> None:
    data = np.zeros((10, 10), dtype=np.uint8)
    path = tmp_path / "a.tif"
    _write_mask(path, data, res=30.0, west=500_000.0, north=500_000.0)
    with rasterio.open(path) as src:
        meta = dict(src.meta)
    grid = grid_from_meta(meta)
    assert grid is not None
    assert grid.width == 10
    bounds = bounds_wgs84(grid)
    assert bounds.west < bounds.east
    assert bounds.south < bounds.north


def test_reproject_mask_maps_known_block(tmp_path: Path) -> None:
    # Destino: 10x10 a 30 m
    dest = np.full((10, 10), 255, dtype=np.uint8)
    dest_path = tmp_path / "dest.tif"
    _write_mask(dest_path, dest, res=30.0, west=500_000.0, north=500_300.0)
    with rasterio.open(dest_path) as src:
        grid = grid_from_meta(dict(src.meta))
    assert grid is not None

    # Origen: 5x5 a 60 m, alineado al mismo origen; bloque 2x2 = 1
    src_data = np.full((5, 5), 255, dtype=np.uint8)
    src_data[0:2, 0:2] = 1
    src_path = tmp_path / "src.tif"
    _write_mask(src_path, src_data, res=60.0, west=500_000.0, north=500_300.0)

    mask, valid = reproject_mask(src_path, grid)
    # Los 60 m cubren 2 píxeles de 30 m → bloque 4x4 de unos
    assert mask[0, 0] == 1
    assert mask[1, 1] == 1
    assert valid[0, 0]
    # Fuera del solape (origen solo cubre 300x300 m = 10 px, así que todo el dest está cubierto)
    # Un píxel nodata del origen debe quedar inválido si no hay dato
    assert valid.sum() >= 4


def test_grid_from_meta_without_crs_returns_none() -> None:
    assert grid_from_meta({"width": 10, "height": 10}) is None
