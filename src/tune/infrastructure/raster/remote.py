"""Lectura por ventana de un GeoTIFF remoto y reproyección a una RasterGrid.

Los tests monkeypatchean ``_open`` o ``_read_window`` para no tocar red.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import numpy as np

from tune.domain.analysis import GeoBounds, RasterGrid
from tune.infrastructure.raster.grid import affine_coeffs, bounds_wgs84, reproject_uint8


def vsi_url(href: str) -> str:
    """Prefija /vsicurl/ salvo file://, /vsi o ruta local."""
    if href.startswith(("/vsi", "file:")):
        return href
    parsed = urlparse(href)
    if parsed.scheme in ("http", "https"):
        return f"/vsicurl/{href}"
    return href


def cache_key(bounds: GeoBounds, extra: str = "") -> str:
    import hashlib  # noqa: PLC0415

    raw = f"{bounds.west:.3f},{bounds.south:.3f},{bounds.east:.3f},{bounds.north:.3f},{extra}"
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def read_window(href: str, bounds: GeoBounds, *, nodata: int | float | None = None):
    """Lee solo la ventana WGS84. Devuelve (array, transform, crs, nodata)."""
    import rasterio  # noqa: PLC0415
    from rasterio.warp import transform_bounds  # noqa: PLC0415
    from rasterio.windows import from_bounds  # noqa: PLC0415

    url = vsi_url(href)
    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
        CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.tiff,.zip",
        GDAL_HTTP_TIMEOUT="120",
    ):
        with rasterio.open(url) as src:
            west, south, east, north = bounds.west, bounds.south, bounds.east, bounds.north
            if src.crs and src.crs.to_epsg() != 4326:
                left, bottom, right, top = transform_bounds(
                    "EPSG:4326", src.crs, west, south, east, north
                )
            else:
                left, bottom, right, top = west, south, east, north
            window = from_bounds(left, bottom, right, top, src.transform)
            window = window.round_lengths().round_offsets()
            fill = src.nodata if nodata is None else nodata
            if fill is None:
                fill = 0
            data = src.read(1, window=window, boundless=True, fill_value=fill)
            transform = src.window_transform(window)
            used_nodata = src.nodata if nodata is None else nodata
            return data, transform, src.crs, used_nodata


def align_to_grid(
    data: np.ndarray,
    transform: Any,
    crs: Any,
    nodata: int,
    grid: RasterGrid,
) -> tuple[np.ndarray, np.ndarray]:
    """Reproyecta uint8 a la grilla. Devuelve (valores, valid)."""
    src = np.asarray(data)
    if src.dtype != np.uint8:
        src = src.astype(np.uint8)
    return reproject_uint8(src, transform, crs, int(nodata), grid)


def write_cache(path: Path, data: np.ndarray, transform: Any, crs: Any, nodata: int) -> None:
    import rasterio  # noqa: PLC0415

    path.parent.mkdir(parents=True, exist_ok=True)
    profile = {
        "driver": "GTiff",
        "height": data.shape[0],
        "width": data.shape[1],
        "count": 1,
        "dtype": data.dtype,
        "crs": crs,
        "transform": transform,
        "nodata": nodata,
        "compress": "lzw",
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(data, 1)


def read_cached(path: Path, grid: RasterGrid, nodata: int) -> tuple[np.ndarray, np.ndarray]:
    import rasterio  # noqa: PLC0415

    with rasterio.open(path) as src:
        return reproject_uint8(src.read(1), src.transform, src.crs, nodata, grid)


def grid_bounds(grid: RasterGrid) -> GeoBounds:
    return bounds_wgs84(grid)


def grid_affine(grid: RasterGrid) -> tuple[float, ...]:
    return grid.transform


def coeffs_of(transform: Any) -> tuple[float, float, float, float, float, float]:
    return affine_coeffs(transform)
