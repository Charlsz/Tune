"""Encadena proveedores de referencia: el primero que responda gana."""

from __future__ import annotations

import logging

from tune.domain.analysis import HazardTask, RasterGrid, ReferenceLayer
from tune.domain.ports import ReferenceProvider
from tune.infrastructure.reference.errors import ReferenceUnavailable

log = logging.getLogger(__name__)


class CompositeReferenceProvider:
    """Prueba proveedores en orden. None o ReferenceUnavailable → siguiente."""

    def __init__(self, providers: list[ReferenceProvider]) -> None:
        self.providers = list(providers)

    def reference(
        self,
        task: HazardTask,
        grid: RasterGrid,
        *,
        exclude_id: str | None = None,
        as_of: str | None = None,
    ) -> ReferenceLayer | None:
        for provider in self.providers:
            try:
                layer = provider.reference(task, grid, exclude_id=exclude_id, as_of=as_of)
            except ReferenceUnavailable as exc:
                log.warning("Proveedor %s: %s", type(provider).__name__, exc)
                continue
            except Exception as exc:
                log.warning("Proveedor %s falló: %s", type(provider).__name__, exc)
                continue
            if layer is not None:
                return layer
        return None

    def pinned(
        self,
        analysis_id: str,
        grid: RasterGrid,
        *,
        task: HazardTask | None = None,
    ) -> ReferenceLayer | None:
        """Delega al primer proveedor que implemente ``pinned`` (historial)."""
        for provider in self.providers:
            fn = getattr(provider, "pinned", None)
            if not callable(fn):
                continue
            try:
                layer = fn(analysis_id, grid, task=task)
            except TypeError:
                layer = fn(analysis_id, grid)
            except Exception as exc:
                log.warning("Pin en %s falló: %s", type(provider).__name__, exc)
                continue
            if layer is not None:
                return layer
        return None
