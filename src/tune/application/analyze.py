"""Caso de uso: imagen satelital -> máscara de peligro (inundación / cicatriz de incendio).

Orquesta segmentador + repositorio (+ referencia opcional); las estadísticas se
calculan aquí para que CLI y API compartan exactamente la misma lógica.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from tune.application.change import change_layers, compare
from tune.application.fusion import fuse
from tune.application.fusion import fusion_layers as build_fusion_layers
from tune.domain.analysis import Analysis, HazardTask, SegmentationOutput
from tune.domain.ports import (
    AnalysisRepository,
    ExposureProvider,
    HazardSegmenter,
    ObservationProvider,
    ReferenceProvider,
)
from tune.infrastructure.raster.grid import grid_from_meta

log = logging.getLogger(__name__)


@dataclass
class AnalyzeUseCase:
    segmenter: HazardSegmenter
    analyses: AnalysisRepository
    reference: ReferenceProvider | None = None
    observation: ObservationProvider | None = None
    exposure: ExposureProvider | None = None

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
            acquired_at=output.acquired_at,
            metadata=output.metadata,
        )
        layers = None
        change = None
        if self.reference is not None:
            try:
                change, layers = self._against_reference(task, output)
            except Exception as exc:
                log.warning("Referencia no disponible: %s", exc)
        if change is not None:
            analysis = replace(analysis, change=change)

        fusion = None
        fused = None
        if self.observation is not None:
            try:
                fusion, fused = self._against_observation(task, output)
            except Exception as exc:
                log.warning("Observación externa no disponible: %s", exc)
        if fusion is not None:
            analysis = replace(analysis, fusion=fusion)

        if self.exposure is not None:
            try:
                new_mask = layers[0] if layers is not None else None
                exposure = self._exposure(output, new_mask)
                if exposure is not None:
                    analysis = replace(analysis, exposure=exposure)
            except Exception as exc:
                log.warning("Exposición no disponible: %s", exc)

        return self.analyses.save(
            analysis, output, geotiff, change_layers=layers, fusion_layers=fused
        )

    def _against_reference(self, task: HazardTask, output: SegmentationOutput):
        grid = grid_from_meta(output.raster_meta)
        if grid is None or self.reference is None:
            return None, None
        layer = self.reference.reference(task, grid, exclude_id=None)
        if layer is None:
            return None, None
        summary = compare(
            output.mask,
            output.valid,
            output.positive_class,
            layer.mask,
            layer.valid,
            output.pixel_area_m2,
            source=layer.source,
            reference_id=layer.reference_id,
            reference_dates=layer.reference_dates,
        )
        layers = change_layers(
            output.mask, output.valid, output.positive_class, layer.mask, layer.valid
        )
        return summary, layers

    def _against_observation(self, task: HazardTask, output: SegmentationOutput):
        grid = grid_from_meta(output.raster_meta)
        if grid is None or self.observation is None:
            return None, None
        raw = self.observation.observe(task, grid, acquired_at=output.acquired_at)
        layers = raw if isinstance(raw, list) else ([raw] if raw is not None else [])
        if not layers:
            return None, None
        summary = fuse(
            output.mask, output.valid, output.positive_class, layers, output.pixel_area_m2
        )
        fused = build_fusion_layers(output.mask, output.valid, output.positive_class, layers)
        return summary, fused

    def _exposure(self, output: SegmentationOutput, new_mask):
        grid = grid_from_meta(output.raster_meta)
        if grid is None or self.exposure is None:
            return None
        if new_mask is None:
            new_mask = (np.asarray(output.mask) == output.positive_class) & np.asarray(
                output.valid, dtype=bool
            )
        return self.exposure.expose(new_mask, output.valid, grid, output.pixel_area_m2)


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
