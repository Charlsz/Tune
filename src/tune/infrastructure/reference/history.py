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
    """Referencia P desde análisis previos del mismo territorio.

    - ≥ ``min_scenes_permanent`` fechas: agua con ocurrencia ≥ ``min_fraction``
      (permanente estable; default 2 fechas, como ADR 010).
    - Exactamente 1 fecha previa: esa máscara es la **línea base**
      (``source=history_baseline``). Así seca→pico distingue cauce/humedal
      previo de agua nueva aunque JRC no marque el humedal como permanente.
    """

    def __init__(
        self,
        repo: AnalysisRepository,
        root: Path,
        *,
        min_scenes: int = 1,
        min_scenes_permanent: int = 2,
        min_fraction: float = 0.75,
        positive_class: int = 1,
    ) -> None:
        self.repo = repo
        self.root = Path(root)
        self.min_scenes = min_scenes
        self.min_scenes_permanent = min_scenes_permanent
        self.min_fraction = min_fraction
        self.positive_class = positive_class

    def reference(
        self,
        task: HazardTask,
        grid: RasterGrid,
        *,
        exclude_id: str | None = None,
        as_of: str | None = None,
    ) -> ReferenceLayer | None:
        try:
            target_bounds = bounds_wgs84(grid)
        except Exception as exc:
            log.warning("No se pudieron obtener bounds de la grilla: %s", exc)
            return None

        as_of_key = _date_key(as_of) if as_of else None

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
            stamp = analysis.acquired_at or analysis.created_at
            if as_of_key is not None:
                prior_key = _date_key(stamp)
                if prior_key is None or prior_key >= as_of_key:
                    continue
            mask_path = self.root / analysis.id / "mask.tif"
            if not mask_path.is_file():
                continue
            candidates.append(analysis)

        if len(candidates) < self.min_scenes:
            return None

        # Cronológico: para línea base de 1 fecha usamos la más reciente *anterior*.
        candidates.sort(key=lambda a: a.acquired_at or a.created_at)

        stack = []
        valid_stack = []
        dates = []
        ids = []
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
            ids.append(analysis.id)

        if len(stack) < self.min_scenes:
            return None

        water = np.stack(stack, axis=0)
        valids = np.stack(valid_stack, axis=0)
        n_valid = valids.sum(axis=0)
        with np.errstate(invalid="ignore", divide="ignore"):
            occurrence = np.where(n_valid > 0, water.sum(axis=0) / np.maximum(n_valid, 1), 0.0)

        if len(stack) >= self.min_scenes_permanent:
            permanent = (occurrence >= self.min_fraction) & (
                n_valid >= self.min_scenes_permanent
            )
            layer_valid = n_valid >= self.min_scenes_permanent
            source = "history"
            reference_id = None
        else:
            # Línea base = última fecha estrictamente anterior (índice -1).
            permanent = water[-1] & valids[-1]
            layer_valid = valids[-1]
            source = "history_baseline"
            reference_id = ids[-1]
            dates = (dates[-1],)
            ids = [ids[-1]]

        return ReferenceLayer(
            mask=permanent,
            valid=layer_valid,
            source=source,
            reference_id=reference_id,
            reference_dates=tuple(dates) if source == "history_baseline" else tuple(sorted(dates)),
        )


def _date_key(value: str | None) -> str | None:
    """Prefijo YYYY-MM-DD comparable; None si no se puede interpretar."""
    if not value:
        return None
    text = str(value).strip()
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    return text[:10] if len(text) >= 10 else text
