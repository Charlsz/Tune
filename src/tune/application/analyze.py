"""Caso de uso: imagen satelital -> máscara de peligro (inundación / cicatriz de incendio).

Orquesta segmentador + repositorio; las estadísticas se calculan aquí para que
CLI y API compartan exactamente la misma lógica.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from tune.domain.analysis import Analysis, HazardTask, SegmentationOutput
from tune.domain.ports import AnalysisRepository, HazardSegmenter


@dataclass
class AnalyzeUseCase:
    segmenter: HazardSegmenter
    analyses: AnalysisRepository

    def execute(self, geotiff: Path, task: HazardTask, *, filename: str | None = None) -> Analysis:
        t0 = time.perf_counter()
        output = self.segmenter.segment(geotiff, task)
        stats = compute_stats(output)
        analysis = Analysis(
            id=uuid.uuid4().hex[:12],
            task=task,
            created_at=datetime.now(timezone.utc).isoformat(),
            model_id=output.model_id,
            input_filename=filename or geotiff.name,
            width=stats.width,
            height=stats.height,
            valid_pixels=stats.valid_pixels,
            affected_pixels=stats.affected_pixels,
            affected_ratio=stats.affected_ratio,
            affected_area_km2=stats.affected_area_km2,
            crs=output.crs,
            bounds=output.bounds,
            latency_s=time.perf_counter() - t0,
        )
        return self.analyses.save(analysis, output, geotiff)


@dataclass(frozen=True)
class MaskStats:
    width: int
    height: int
    valid_pixels: int
    affected_pixels: int
    affected_ratio: float
    affected_area_km2: float | None


def compute_stats(output: SegmentationOutput) -> MaskStats:
    mask = np.asarray(output.mask)
    valid = np.asarray(output.valid, dtype=bool)
    if mask.shape != valid.shape:
        raise ValueError(f"mask {mask.shape} y valid {valid.shape} no coinciden")
    height, width = mask.shape
    affected = (mask == output.positive_class) & valid
    n_valid = int(valid.sum())
    n_aff = int(affected.sum())
    ratio = n_aff / n_valid if n_valid else 0.0
    area_km2 = None
    if output.pixel_area_m2 is not None:
        area_km2 = n_aff * output.pixel_area_m2 / 1e6
    return MaskStats(
        width=int(width),
        height=int(height),
        valid_pixels=n_valid,
        affected_pixels=n_aff,
        affected_ratio=float(ratio),
        affected_area_km2=area_km2,
    )
