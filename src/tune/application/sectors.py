"""Agregación espacial: sectores críticos por celda."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from tune.domain.analysis import GeoBounds, RasterGrid
from tune.infrastructure.raster.grid import cell_bounds_wgs84


@dataclass(frozen=True)
class Sector:
    row: int
    col: int
    bounds: GeoBounds
    new_pixels: int
    new_km2: float | None
    fraction: float
    rank: int


def sectors(
    mask_new: np.ndarray,
    valid: np.ndarray,
    grid: RasterGrid,
    *,
    cell_m: int = 1000,
    pixel_area_m2: float | None = None,
    top: int | None = None,
) -> list[Sector]:
    """Divide la grilla en celdas de ~cell_m metros y rankea por agua nueva."""
    new = np.asarray(mask_new, dtype=bool)
    val = np.asarray(valid, dtype=bool)
    h, w = new.shape
    if h != grid.height or w != grid.width:
        raise ValueError(f"mask {new.shape} no coincide con grilla {grid.height}x{grid.width}")

    a, _b, _c, _d, e, _f = grid.transform
    # Tamaño de celda en píxeles
    if grid.crs.endswith(":4326") or grid.crs in ("EPSG:4326", "OGC:CRS84"):
        lat = _f_center_lat(grid)
        m_per_deg_lat = 110_570.0
        m_per_deg_lon = 111_320.0 * float(np.cos(np.deg2rad(lat)))
        px_m_x = abs(a) * m_per_deg_lon
        px_m_y = abs(e) * m_per_deg_lat
    else:
        px_m_x = abs(a)
        px_m_y = abs(e)
    cell_w = max(1, int(round(cell_m / px_m_x))) if px_m_x > 0 else max(1, w)
    cell_h = max(1, int(round(cell_m / px_m_y))) if px_m_y > 0 else max(1, h)

    rows = []
    for r in range(0, h, cell_h):
        for c in range(0, w, cell_w):
            block_new = new[r : r + cell_h, c : c + cell_w]
            block_val = val[r : r + cell_h, c : c + cell_w]
            n_val = int(block_val.sum())
            if n_val == 0:
                continue
            n_new = int((block_new & block_val).sum())
            if n_new == 0:
                continue
            area = (n_new * pixel_area_m2 / 1e6) if pixel_area_m2 is not None else None
            n_rows = min(cell_h, h - r)
            n_cols = min(cell_w, w - c)
            bounds = cell_bounds_wgs84(grid, r, c, n_rows, n_cols)
            rows.append(
                Sector(
                    row=r // cell_h,
                    col=c // cell_w,
                    bounds=bounds,
                    new_pixels=n_new,
                    new_km2=area,
                    fraction=n_new / n_val,
                    rank=0,
                )
            )
    rows.sort(key=lambda s: (s.new_km2 or 0.0, s.new_pixels), reverse=True)
    ranked = [
        Sector(
            row=s.row,
            col=s.col,
            bounds=s.bounds,
            new_pixels=s.new_pixels,
            new_km2=s.new_km2,
            fraction=s.fraction,
            rank=i + 1,
        )
        for i, s in enumerate(rows)
    ]
    if top is not None:
        ranked = ranked[:top]
    return ranked


def _f_center_lat(grid: RasterGrid) -> float:
    _a, _b, _c, _d, e, f = grid.transform
    return f + e * (grid.height / 2)
