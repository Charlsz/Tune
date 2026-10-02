"""Referencia por historial del territorio."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pytest

rasterio = pytest.importorskip("rasterio")
from rasterio.transform import from_origin

from tune.domain.analysis import Analysis, GeoBounds, HazardTask, RasterGrid, SegmentationOutput
from tune.infrastructure.analyses import FileAnalysisRepository
from tune.infrastructure.reference.history import HistoryReferenceProvider


def _geotiff(path: Path, data: np.ndarray) -> dict:
    transform = from_origin(500_000.0, 500_300.0, 30.0, 30.0)
    profile = {
        "driver": "GTiff",
        "height": data.shape[0],
        "width": data.shape[1],
        "count": 1,
        "dtype": "uint8",
        "crs": "EPSG:32618",
        "transform": transform,
        "nodata": 255,
        "compress": "lzw",
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(data, 1)
    return dict(profile)


def _save_analysis(repo: FileAnalysisRepository, folder_root: Path, mask: np.ndarray, *, date: str) -> Analysis:
    h, w = mask.shape
    meta = _geotiff(folder_root / "tmp.tif", mask)
    from tune.infrastructure.raster.grid import bounds_wgs84, grid_from_meta

    grid = grid_from_meta(meta)
    assert grid is not None
    bounds = bounds_wgs84(grid)
    out = SegmentationOutput(
        mask=mask,
        valid=mask != 255,
        model_id="fake",
        positive_class=1,
        class_names=("no", "yes"),
        crs="EPSG:32618",
        bounds=bounds,
        pixel_area_m2=900.0,
        raster_meta=meta,
    )
    analysis = Analysis(
        id=uuid.uuid4().hex[:12],
        task=HazardTask.FLOOD,
        created_at=datetime.now(timezone.utc).isoformat(),
        model_id="fake",
        input_filename=f"{date}.tif",
        width=w,
        height=h,
        valid_pixels=int((mask != 255).sum()),
        affected_pixels=int((mask == 1).sum()),
        affected_ratio=0.5,
        affected_area_km2=0.01,
        crs="EPSG:32618",
        bounds=bounds,
        latency_s=0.1,
        acquired_at=date,
    )
    src = folder_root / "tmp.tif"
    return repo.save(analysis, out, src)


def test_history_needs_at_least_two_scenes(tmp_path: Path) -> None:
    repo = FileAnalysisRepository(tmp_path / "analyses")
    mask = np.zeros((10, 10), dtype=np.uint8)
    mask[0:4, 0:4] = 1
    _save_analysis(repo, tmp_path, mask, date="2020-01-01")
    provider = HistoryReferenceProvider(repo, tmp_path / "analyses", min_scenes=2)
    grid = RasterGrid(
        crs="EPSG:32618",
        transform=(30.0, 0.0, 500_000.0, 0.0, -30.0, 500_300.0),
        width=10,
        height=10,
    )
    assert provider.reference(HazardTask.FLOOD, grid) is None


def test_history_permanent_where_water_in_all_scenes(tmp_path: Path) -> None:
    repo = FileAnalysisRepository(tmp_path / "analyses")
    # Bloque A (0:4,0:4) en agua en 3/3; bloque B (0:4,6:8) solo en 1/3
    for i, date in enumerate(("2020-01-01", "2020-02-01", "2020-03-01")):
        mask = np.zeros((10, 10), dtype=np.uint8)
        mask[0:4, 0:4] = 1
        if i == 0:
            mask[0:4, 6:8] = 1
        _save_analysis(repo, tmp_path, mask, date=date)

    provider = HistoryReferenceProvider(repo, tmp_path / "analyses", min_scenes=2, min_fraction=0.75)
    grid = RasterGrid(
        crs="EPSG:32618",
        transform=(30.0, 0.0, 500_000.0, 0.0, -30.0, 500_300.0),
        width=10,
        height=10,
    )
    layer = provider.reference(HazardTask.FLOOD, grid)
    assert layer is not None
    assert layer.source == "history"
    assert len(layer.reference_dates) == 3
    p = np.asarray(layer.mask)
    assert p[1, 1]  # bloque A
    assert not p[1, 7]  # bloque B solo 1/3


def test_history_exclude_id(tmp_path: Path) -> None:
    repo = FileAnalysisRepository(tmp_path / "analyses")
    ids = []
    for date in ("2020-01-01", "2020-02-01", "2020-03-01"):
        mask = np.ones((10, 10), dtype=np.uint8)
        ids.append(_save_analysis(repo, tmp_path, mask, date=date).id)
    provider = HistoryReferenceProvider(repo, tmp_path / "analyses", min_scenes=2)
    grid = RasterGrid(
        crs="EPSG:32618",
        transform=(30.0, 0.0, 500_000.0, 0.0, -30.0, 500_300.0),
        width=10,
        height=10,
    )
    # Excluir dos deja solo uno → None
    layer = provider.reference(HazardTask.FLOOD, grid, exclude_id=ids[0])
    # Aún quedan 2, debe funcionar
    assert layer is not None
