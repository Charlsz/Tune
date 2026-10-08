"""ESA WorldCover 2021 a 10 m, por tiles de 3° en S3 (lectura por ventana)."""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np

from tune.domain.analysis import GeoBounds, RasterGrid
from tune.infrastructure.raster.grid import bounds_wgs84
from tune.infrastructure.raster.remote import (
    align_to_grid,
    cache_key,
    read_cached,
    read_window,
    write_cache,
)
from tune.infrastructure.reference.errors import ReferenceUnavailable

S3 = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map"
NODATA = 0


def tile_id(lon: float, lat: float) -> str:
    """Tile de 3° nombrado por su esquina suroeste (N09W075, S03E012)."""
    west = int(math.floor(lon / 3.0) * 3)
    south = int(math.floor(lat / 3.0) * 3)
    lat_label = f"N{south:02d}" if south >= 0 else f"S{abs(south):02d}"
    lon_label = f"E{west:03d}" if west >= 0 else f"W{abs(west):03d}"
    return f"{lat_label}{lon_label}"


def tile_url(name: str) -> str:
    return f"{S3}/ESA_WorldCover_10m_2021_v200_{name}_Map.tif"


def tiles_for_bounds(bounds: GeoBounds) -> list[str]:
    lons = np.linspace(
        bounds.west, bounds.east, num=max(2, int((bounds.east - bounds.west) / 1.5) + 2)
    )
    lats = np.linspace(
        bounds.south, bounds.north, num=max(2, int((bounds.north - bounds.south) / 1.5) + 2)
    )
    names: set[str] = set()
    for lon in lons:
        for lat in lats:
            names.add(
                tile_id(float(min(lon, bounds.east - 1e-9)), float(min(lat, bounds.north - 1e-9)))
            )
    return sorted(names)


class WorldCoverProvider:
    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def landcover(self, grid: RasterGrid) -> tuple[np.ndarray, np.ndarray]:
        bounds = bounds_wgs84(grid)
        key = cache_key(bounds, f"wc:{grid.width}x{grid.height}")
        path = self.cache_dir / f"{key}.tif"
        if path.is_file():
            data, valid = read_cached(path, grid, NODATA)
            return data, valid
        names = tiles_for_bounds(bounds)
        if not names:
            raise ReferenceUnavailable("Ningún tile WorldCover para esos bounds")
        raw, transform, crs, _ = self._read_window(tile_url(names[0]), bounds)
        write_cache(path, np.asarray(raw), transform, crs, NODATA)
        return align_to_grid(np.asarray(raw), transform, crs, NODATA, grid)

    def _read_window(self, href: str, bounds: GeoBounds):
        return read_window(href, bounds, nodata=NODATA)
