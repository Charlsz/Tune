"""Observación de agua/inundación desde un catálogo STAC (GFM, OPERA).

Los tests monkeypatchean ``_search`` y ``_read_window``. OPERA exige token
Earthdata; si falta, el proveedor devuelve None y el análisis sigue.
"""

from __future__ import annotations

import logging
import os
from datetime import date, timedelta
from pathlib import Path

import numpy as np

from tune.domain.analysis import HazardTask, ObservationLayer, RasterGrid
from tune.infrastructure.raster.grid import bounds_wgs84
from tune.infrastructure.raster.remote import (
    align_to_grid,
    cache_key,
    read_cached,
    read_window,
    write_cache,
)
from tune.infrastructure.reference.errors import ReferenceUnavailable

log = logging.getLogger(__name__)

PRESETS: dict[str, dict] = {
    "gfm": {
        "stac_url": "https://stac.eodc.eu/api/v1",
        "collection": "GFM",
        "asset_keys": ("ensemble_flood_extent",),
        "positive": (1,),
        "nodata": 255,
        "source": "gfm",
        "needs_token": False,
        "window_days": 6,
    },
    "opera_dswx_hls": {
        "stac_url": "https://cmr.earthdata.nasa.gov/stac/POCLOUD",
        "collection": "OPERA_L3_DSWX-HLS_V1_1.0",
        "asset_keys": ("0_B01_WTR",),
        "positive": (1, 2),
        "nodata": 255,
        "source": "opera_dswx_hls",
        "needs_token": True,
        "window_days": 5,
    },
    "opera_dswx_s1": {
        "stac_url": "https://cmr.earthdata.nasa.gov/stac/POCLOUD",
        "collection": "OPERA_L3_DSWX-S1_V1_1.0",
        "asset_keys": ("0_B01_WTR",),
        "positive": (1, 2),
        "nodata": 255,
        "source": "opera_dswx_s1",
        "needs_token": True,
        "window_days": 8,
    },
}


class StacObservationProvider:
    """Busca el ítem STAC más cercano a acquired_at y alinea la capa a la grilla."""

    def __init__(
        self,
        preset: str,
        cache_dir: Path,
        *,
        token: str | None = None,
        timeout_s: int = 120,
    ) -> None:
        if preset not in PRESETS:
            raise ValueError(f"preset desconocido: {preset}")
        self.preset = preset
        self.cfg = PRESETS[preset]
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.token = token or os.environ.get("EARTHDATA_TOKEN")
        self.timeout_s = timeout_s

    def observe(
        self,
        task: HazardTask,
        grid: RasterGrid,
        *,
        acquired_at: str | None = None,
    ) -> ObservationLayer | None:
        if task is not HazardTask.FLOOD:
            return None
        if self.cfg["needs_token"] and not self.token:
            log.info("%s requiere EARTHDATA_TOKEN; se omite", self.preset)
            return None
        try:
            bounds = bounds_wgs84(grid)
        except Exception as exc:
            raise ReferenceUnavailable(f"bounds: {exc}") from exc

        day = (acquired_at or "")[:10] or date.today().isoformat()
        key = cache_key(bounds, f"{self.preset}:{day}:{grid.width}x{grid.height}")
        cache_path = self.cache_dir / f"{key}.tif"
        if cache_path.is_file():
            data, valid = read_cached(cache_path, grid, int(self.cfg["nodata"]))
            water = np.isin(data, list(self.cfg["positive"])) & valid
            return ObservationLayer(
                mask=water, valid=valid, source=self.cfg["source"], acquired_at=day
            )

        item = self._search(bounds, day)
        if item is None:
            return None
        href = self._asset_href(item)
        if href is None:
            return None
        try:
            raw, transform, crs, nodata = self._read_window(href, bounds)
        except Exception as exc:
            raise ReferenceUnavailable(f"{self.preset} no leyó el asset: {exc}") from exc
        nodata_i = int(self.cfg["nodata"] if nodata is None else nodata)
        write_cache(cache_path, np.asarray(raw), transform, crs, nodata_i)
        aligned, valid = align_to_grid(np.asarray(raw), transform, crs, nodata_i, grid)
        water = np.isin(aligned, list(self.cfg["positive"])) & valid
        item_id = getattr(item, "id", None)
        return ObservationLayer(
            mask=water,
            valid=valid,
            source=self.cfg["source"],
            item_id=str(item_id) if item_id else None,
            acquired_at=day,
        )

    def _search(self, bounds, day: str):
        """Devuelve el ítem STAC más cercano. Se monkeypatchea en tests."""
        try:
            from pystac_client import Client  # noqa: PLC0415
        except ImportError as exc:
            raise ReferenceUnavailable("pystac-client no está instalado") from exc
        window = int(self.cfg["window_days"])
        center = date.fromisoformat(day)
        start = (center - timedelta(days=window)).isoformat()
        end = (center + timedelta(days=window)).isoformat()
        bbox = (bounds.west, bounds.south, bounds.east, bounds.north)
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        client = Client.open(self.cfg["stac_url"], headers=headers or None)
        search = client.search(
            collections=[self.cfg["collection"]],
            bbox=bbox,
            datetime=f"{start}/{end}",
            max_items=20,
        )
        items = list(search.items())
        if not items:
            return None

        def _dt(item) -> str:
            props = getattr(item, "properties", None) or {}
            raw = props.get("datetime") or (
                item.datetime.isoformat() if getattr(item, "datetime", None) else day
            )
            return str(raw)[:10]

        items.sort(key=lambda it: abs(_ordinal(_dt(it)) - _ordinal(day)))
        return items[0]

    def _asset_href(self, item) -> str | None:
        assets = getattr(item, "assets", {}) or {}
        for key in self.cfg["asset_keys"]:
            asset = assets.get(key)
            if asset is not None:
                return asset.href
        return None

    def _read_window(self, href: str, bounds):
        return read_window(href, bounds, nodata=self.cfg["nodata"])


class CompositeObservationProvider:
    """Prueba proveedores en orden y junta las capas que respondan."""

    def __init__(self, providers: list[StacObservationProvider]) -> None:
        self.providers = list(providers)

    def observe(
        self,
        task: HazardTask,
        grid: RasterGrid,
        *,
        acquired_at: str | None = None,
    ) -> list[ObservationLayer]:
        found: list[ObservationLayer] = []
        for provider in self.providers:
            try:
                layer = provider.observe(task, grid, acquired_at=acquired_at)
            except ReferenceUnavailable as exc:
                log.warning("Observación %s: %s", type(provider).__name__, exc)
                continue
            except Exception as exc:
                log.warning("Observación %s falló: %s", type(provider).__name__, exc)
                continue
            if layer is not None:
                found.append(layer)
        return found


def _ordinal(day: str) -> int:
    try:
        return date.fromisoformat(day[:10]).toordinal()
    except ValueError:
        return 0
