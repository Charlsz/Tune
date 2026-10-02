"""Referencia de agua permanente / cicatriz a partir del historial del territorio."""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from tune.application.territory import same_territory
from tune.domain.analysis import HazardTask, RasterGrid, ReferenceLayer
from tune.domain.ports import AnalysisRepository
from tune.infrastructure.raster.grid import bounds_wgs84, reproject_mask

log = logging.getLogger(__name__)


class HistoryReferenceProvider:
    """Construye P como ocurrencia ≥ min_fraction en al menos min_scenes fechas previas."""

    def __init__(
        self,
        repo: AnalysisRepository,
        root: Path,
        *,
        min_scenes: int = 2,
        min_fraction: float = 0.75,
        positive_class: int = 1,
    ) -> None:
        self.repo = repo
        self.root = Path(root)
        self.min_scenes = min_scenes
        self.min_fraction = min_fraction
        self.positive_class = positive_class

    def reference(
        self, task: HazardTask, grid: RasterGrid, *, exclude_id: str | None = None
    ) -> ReferenceLayer | None:
        try:
            target_bounds = bounds_wgs84(grid)
        except Exception as exc:
            log.warning("No se pudieron obtener bounds de la grilla: %s", exc)
            return None

        candidates = []
        for analysis in self.repo.list(limit=10_000):
            if analysis.task is not task:
                continue
            if exclude_id and analysis.id == exclude_id:
                continue
            if analysis.bounds is None:
                continue
            if not same_territory(analysis.bounds, target_bounds):
                continue
            mask_path = self.root / analysis.id / "mask.tif"
            if not mask_path.is_file():
                continue
            candidates.append(analysis)

        if len(candidates) < self.min_scenes:
            return None

        stack = []
        valid_stack = []
        dates = []
        for analysis in candidates:
            mask_path = self.root / analysis.id / "mask.tif"
            try:
                mask, valid = reproject_mask(mask_path, grid)
            except Exception as exc:
                log.warning("No se pudo reproyectar %s: %s", mask_path, exc)
                continue
            stack.append(mask == self.positive_class)
            valid_stack.append(valid)
            dates.append(analysis.acquired_at or analysis.created_at)

        if len(stack) < self.min_scenes:
            return None

        water = np.stack(stack, axis=0)
        valids = np.stack(valid_stack, axis=0)
        n_valid = valids.sum(axis=0)
        with np.errstate(invalid="ignore", divide="ignore"):
            occurrence = np.where(n_valid > 0, water.sum(axis=0) / np.maximum(n_valid, 1), 0.0)
        permanent = (occurrence >= self.min_fraction) & (n_valid >= self.min_scenes)
        layer_valid = n_valid >= self.min_scenes
        return ReferenceLayer(
            mask=permanent,
            valid=layer_valid,
            source="history",
            reference_id=None,
            reference_dates=tuple(sorted(dates)),
        )
