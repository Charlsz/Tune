"""Cruza la máscara nueva con WorldCover y GHSL. Un fallo no tumba el análisis."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from tune.application.exposure import expose
from tune.domain.analysis import ExposureSummary, RasterGrid
from tune.infrastructure.exposure.population import GhslPopulationProvider
from tune.infrastructure.exposure.worldcover import WorldCoverProvider

log = logging.getLogger(__name__)


class RasterExposureProvider:
    def __init__(self, cache_dir: Path) -> None:
        root = Path(cache_dir)
        self.land = WorldCoverProvider(root / "worldcover")
        self.pop = GhslPopulationProvider(root / "population")

    def expose(
        self,
        new_mask: Any,
        valid: Any,
        grid: RasterGrid,
        pixel_area_m2: float | None,
    ) -> ExposureSummary | None:
        try:
            land, land_valid = self.land.landcover(grid)
        except Exception as exc:
            log.warning("WorldCover no disponible: %s", exc)
            return None
        pop = pop_valid = None
        try:
            pop, pop_valid = self.pop.population(grid)
        except Exception as exc:
            log.warning("GHSL no disponible: %s", exc)
        return expose(
            new_mask,
            valid,
            land,
            land_valid,
            pop,
            pop_valid,
            pixel_area_m2,
        )
