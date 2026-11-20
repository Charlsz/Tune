"""Color y nodata de mask.png (Antes/Después = azul agua; nunca nodata)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from tune.domain.analysis import GeoBounds, SegmentationOutput
from tune.infrastructure.analyses.filesystem import MASK_COLOR, write_mask_png


def _output() -> SegmentationOutput:
    mask = np.zeros((4, 5), dtype=np.uint8)
    mask[0, :] = 1  # agua
    mask[1, 0] = 1  # agua en nodata → no debe pintarse
    valid = np.ones((4, 5), dtype=bool)
    valid[1, 0] = False
    valid[3, 4] = False
    return SegmentationOutput(
        mask=mask,
        valid=valid,
        model_id="fake/prithvi",
        positive_class=1,
        class_names=("no", "yes"),
        crs="EPSG:32618",
        bounds=GeoBounds(west=-75.0, south=4.0, east=-74.9, north=4.1),
        pixel_area_m2=900.0,
        raster_meta={},
        rgb_preview=np.zeros((3, 4, 5), dtype=np.uint8),
    )


def test_write_mask_png_uses_water_blue_and_skips_nodata(tmp_path: Path) -> None:
    path = tmp_path / "mask.png"
    write_mask_png(_output(), path)
    arr = np.asarray(Image.open(path).convert("RGBA"))
    # Agua válida (fila 0): azul data-water
    assert tuple(arr[0, 0]) == MASK_COLOR
    assert MASK_COLOR[:3] == (37, 99, 235)
    # Positivo sobre nodata: transparente
    assert arr[1, 0, 3] == 0
    # Nodata sin clase: transparente
    assert arr[3, 4, 3] == 0
    # Tierra válida: transparente
    assert arr[2, 2, 3] == 0
