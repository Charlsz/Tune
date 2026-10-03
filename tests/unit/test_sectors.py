"""Sectores críticos."""

import numpy as np

from tune.application.sectors import sectors
from tune.domain.analysis import RasterGrid


def test_sectors_rank_by_new_area() -> None:
    # 4x4 grilla, celdas de 2x2 px = 60 m si px=30
    mask = np.zeros((4, 4), dtype=bool)
    mask[0:2, 0:2] = True  # 4 píxeles
    mask[2:4, 2:4] = True  # 4 píxeles
    mask[0, 2] = True  # 1 píxel extra en otra celda → esa tendrá 1
    valid = np.ones((4, 4), dtype=bool)
    grid = RasterGrid(
        crs="EPSG:32618",
        transform=(30.0, 0.0, 500_000.0, 0.0, -30.0, 500_120.0),
        width=4,
        height=4,
    )
    found = sectors(mask, valid, grid, cell_m=60, pixel_area_m2=900.0, top=10)
    assert len(found) >= 2
    assert found[0].rank == 1
    assert found[0].new_pixels >= found[-1].new_pixels
    assert found[0].new_km2 == found[0].new_pixels * 900 / 1e6
