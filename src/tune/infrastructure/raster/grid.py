"""Grilla raster y reproyección de máscaras (imports perezosos de rasterio)."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np

from tune.domain.analysis import GeoBounds, RasterGrid

log = logging.getLogger(__name__)


def _import(name: str):
    import importlib  # noqa: PLC0415

    return importlib.import_module(name)


def affine_coeffs(transform: Any) -> tuple[float, float, float, float, float, float]:
    """Lee a..f sin iterar el Affine (affine 3.x revienta al indexar / _astuple)."""
    return (
        float(transform.a),
        float(transform.b),
        float(transform.c),
        float(transform.d),
        float(transform.e),
        float(transform.f),
    )


def grid_from_meta(raster_meta: dict[str, Any]) -> RasterGrid | None:
    """Construye RasterGrid desde el meta de rasterio. None si falta crs o transform."""
    crs = raster_meta.get("crs")
    transform = raster_meta.get("transform")
    width = raster_meta.get("width")
    height = raster_meta.get("height")
    if crs is None or transform is None or not width or not height:
        return None
    crs_str = crs.to_string() if hasattr(crs, "to_string") else str(crs)
    return RasterGrid(
        crs=crs_str,
        transform=affine_coeffs(transform),
        width=int(width),
        height=int(height),
    )


def bounds_wgs84(grid: RasterGrid) -> GeoBounds:
    """Caja de la grilla en EPSG:4326."""
    a, b, c, d, e, f = grid.transform
    w, h = float(grid.width), float(grid.height)
    xs = (c, c + a * w, c + b * h, c + a * w + b * h)
    ys = (f, f + d * w, f + e * h, f + d * w + e * h)
    west, east = min(xs), max(xs)
    south, north = min(ys), max(ys)
    if grid.crs in ("EPSG:4326", "OGC:CRS84") or grid.crs.endswith(":4326"):
        return GeoBounds(west=west, south=south, east=east, north=north)
    rasterio = _import("rasterio")
    from rasterio.warp import transform_bounds  # noqa: PLC0415

    ww, ss, ee, nn = transform_bounds(
        rasterio.crs.CRS.from_user_input(grid.crs),
        "EPSG:4326",
        west,
        south,
        east,
        north,
        densify_pts=21,
    )
    return GeoBounds(west=ww, south=ss, east=ee, north=nn)


def reproject_mask(src_path: Path, grid: RasterGrid) -> tuple[np.ndarray, np.ndarray]:
    """Reproyecta un mask.tif (uint8, nodata 255) a la grilla destino.

    Devuelve ``(mask uint8, valid bool)``. Fuera del solape, valid es False.
    """
    rasterio = _import("rasterio")
    from rasterio.warp import Resampling, reproject  # noqa: PLC0415

    dst = np.full((grid.height, grid.width), 255, dtype=np.uint8)
    with rasterio.open(src_path) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=dst,
            src_transform=src.transform,
            src_crs=src.crs,
            src_nodata=255,
            dst_transform=rasterio.Affine(*grid.transform),
            dst_crs=rasterio.crs.CRS.from_user_input(grid.crs),
            dst_nodata=255,
            resampling=Resampling.nearest,
        )
    valid = dst != 255
    return dst, valid


def reproject_uint8(
    data: np.ndarray,
    src_transform: Any,
    src_crs: Any,
    src_nodata: int,
    grid: RasterGrid,
) -> tuple[np.ndarray, np.ndarray]:
    """Reproyecta un array uint8 en memoria a la grilla destino."""
    rasterio = _import("rasterio")
    from rasterio.warp import Resampling, reproject  # noqa: PLC0415

    dst = np.full((grid.height, grid.width), src_nodata, dtype=np.uint8)
    reproject(
        source=data,
        destination=dst,
        src_transform=src_transform,
        src_crs=src_crs,
        src_nodata=src_nodata,
        dst_transform=rasterio.Affine(*grid.transform),
        dst_crs=rasterio.crs.CRS.from_user_input(grid.crs),
        dst_nodata=src_nodata,
        resampling=Resampling.nearest,
    )
    valid = dst != src_nodata
    return dst, valid


def cell_bounds_wgs84(grid: RasterGrid, row: int, col: int, n_rows: int, n_cols: int) -> GeoBounds:
    """Caja WGS84 de una celda (row, col) de n_rows x n_cols píxeles."""
    a, _b, c, _d, e, f = grid.transform
    x0 = c + a * col
    y0 = f + e * row
    x1 = c + a * (col + n_cols)
    y1 = f + e * (row + n_rows)
    west, east = min(x0, x1), max(x0, x1)
    south, north = min(y0, y1), max(y0, y1)
    if grid.crs in ("EPSG:4326", "OGC:CRS84") or grid.crs.endswith(":4326"):
        return GeoBounds(west=west, south=south, east=east, north=north)
    rasterio = _import("rasterio")
    from rasterio.warp import transform as warp_xy  # noqa: PLC0415

    xs, ys = warp_xy(
        rasterio.crs.CRS.from_user_input(grid.crs),
        "EPSG:4326",
        [west, east, east, west],
        [south, south, north, north],
    )
    return GeoBounds(west=min(xs), south=min(ys), east=max(xs), north=max(ys))
