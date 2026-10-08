"""Población GHSL 2020 (3 arc-sec, tiles 10°×10° empaquetados en zip)."""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np

from tune.domain.analysis import GeoBounds, RasterGrid
from tune.infrastructure.raster.grid import bounds_wgs84
from tune.infrastructure.raster.remote import cache_key, read_window, write_cache
from tune.infrastructure.reference.errors import ReferenceUnavailable

GHSL_BASE = (
    "https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/"
    "GHS_POP_GLOBE_R2023A/GHS_POP_E2020_GLOBE_R2023A_4326_3ss/V1-0/tiles"
)
# Convención de tiles GHSL 3ss: R aumenta hacia el sur, C hacia el este.
# R1C1 cubre [80N,70N] × [-180,-170]. Fórmula verificada con R9C11 ([-80,-70]×[-0.9,9.1]).
NODATA = -200


def tile_rc(lon: float, lat: float) -> tuple[int, int]:
    col = int(math.floor((lon + 180.0) / 10.0)) + 1
    row = int(math.floor((80.0 - lat) / 10.0)) + 1
    return max(1, row), max(1, col)


def tile_zip_url(row: int, col: int) -> str:
    name = f"GHS_POP_E2020_GLOBE_R2023A_4326_3ss_V1_0_R{row}_C{col}"
    return f"/vsizip//vsicurl/{GHSL_BASE}/{name}.zip/{name}.tif"


class GhslPopulationProvider:
    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def population(self, grid: RasterGrid) -> tuple[np.ndarray, np.ndarray]:
        bounds = bounds_wgs84(grid)
        key = cache_key(bounds, f"ghsl:{grid.width}x{grid.height}")
        path = self.cache_dir / f"{key}.tif"
        row, col = tile_rc((bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2)
        href = tile_zip_url(row, col)
        if path.is_file():
            return self._align_float(path, grid)
        try:
            raw, transform, crs, nodata = self._read_window(href, bounds)
        except Exception as exc:
            raise ReferenceUnavailable(f"GHSL no respondió: {exc}") from exc
        fill = NODATA if nodata is None else float(nodata)
        write_cache(path, np.asarray(raw), transform, crs, int(fill) if fill == int(fill) else -200)
        return self._reproject_float(np.asarray(raw), transform, crs, fill, grid)

    def _read_window(self, href: str, bounds: GeoBounds):
        return read_window(href, bounds, nodata=NODATA)

    def _align_float(self, path: Path, grid: RasterGrid) -> tuple[np.ndarray, np.ndarray]:
        import rasterio  # noqa: PLC0415

        with rasterio.open(path) as src:
            return self._reproject_float(src.read(1), src.transform, src.crs, NODATA, grid)

    def _reproject_float(self, data, transform, crs, nodata, grid: RasterGrid):
        # reproject_uint8 no sirve para float; nearest sobre float64.
        import rasterio  # noqa: PLC0415
        from rasterio.warp import Resampling, reproject  # noqa: PLC0415

        dst = np.full((grid.height, grid.width), float(nodata), dtype=np.float32)
        reproject(
            source=np.asarray(data, dtype=np.float32),
            destination=dst,
            src_transform=transform,
            src_crs=crs,
            src_nodata=nodata,
            dst_transform=rasterio.Affine(*grid.transform),
            dst_crs=rasterio.crs.CRS.from_user_input(grid.crs),
            dst_nodata=float(nodata),
            resampling=Resampling.nearest,
        )
        valid = dst != float(nodata)
        dst = np.where(dst < 0, 0.0, dst)
        return dst, valid
