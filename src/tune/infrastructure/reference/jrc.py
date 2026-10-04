"""Referencia de agua permanente vía JRC Global Surface Water (occurrence)."""

from __future__ import annotations

import hashlib
import logging
import math
from pathlib import Path

import numpy as np

from tune.domain.analysis import GeoBounds, HazardTask, RasterGrid, ReferenceLayer
from tune.infrastructure.raster.grid import bounds_wgs84, reproject_uint8
from tune.infrastructure.reference.errors import ReferenceUnavailable

log = logging.getLogger(__name__)

JRC_BASE = "https://storage.googleapis.com/global-surface-water/downloads2021/occurrence"
# Nodata en occurrence: 255. 0 = nunca agua (válido).
JRC_NODATA = 255


def tile_name(lon: float, lat: float) -> str:
    """Nombre del tile JRC de 10° para un punto (lon, lat) WGS84.

    El tile se nombra por su esquina superior izquierda. Ejemplos:
    (-74.1, 4.6) → occurrence_80W_10Nv1_4_2021.tif
    (-80.0, 10.0) → occurrence_80W_20Nv1_4_2021.tif  (borde norte del tile 10N)
    """
    west = int(math.floor(lon / 10.0) * 10)
    # Latitud de la esquina norte: el menor múltiplo de 10 estrictamente > lat,
    # o lat+10 si lat es múltiplo de 10 (el punto cae en el tile de arriba).
    if lat % 10 == 0:
        north = int(lat) + 10
    else:
        north = int(math.ceil(lat / 10.0) * 10)

    if west < 0:
        lon_label = f"{abs(west)}W"
    else:
        lon_label = f"{west}E"
    if north > 0:
        lat_label = f"{north}N"
    elif north < 0:
        lat_label = f"{abs(north)}S"
    else:
        # north == 0: tile ecuatorial; 0N no existe en JRC, es 0S (cubre [-10, 0])
        # o 10N (cubre [0, 10]). Si lat < 0 → 0S; si lat >= 0 no deberíamos llegar aquí
        # porque lat en [0,10) da north=10.
        lat_label = "0S" if lat < 0 else "10N"
    return f"occurrence_{lon_label}_{lat_label}v1_4_2021.tif"


def tiles_for_bounds(bounds: GeoBounds) -> list[str]:
    """Tiles de 10° que intersectan la caja (normalmente 1, a veces 2 o 4)."""
    # Muestrear una grilla de puntos en el interior para no perder bordes
    lons = np.linspace(
        bounds.west, bounds.east, num=max(2, int((bounds.east - bounds.west) / 5) + 2)
    )
    lats = np.linspace(
        bounds.south, bounds.north, num=max(2, int((bounds.north - bounds.south) / 5) + 2)
    )
    names: set[str] = set()
    for lon in lons:
        for lat in lats:
            # Evitar el borde este/norte exacto que caería en el tile vecino
            lon_c = min(lon, bounds.east - 1e-9)
            lat_c = min(lat, bounds.north - 1e-9)
            names.add(tile_name(float(lon_c), float(lat_c)))
    return sorted(names)


def tile_url(name: str) -> str:
    return f"{JRC_BASE}/{name}"


class JrcReferenceProvider:
    """Agua permanente = occurrence ≥ permanent_pct. Solo para inundación."""

    def __init__(
        self,
        cache_dir: Path,
        *,
        permanent_pct: int = 75,
        timeout_s: int = 120,
    ) -> None:
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.permanent_pct = permanent_pct
        self.timeout_s = timeout_s

    def reference(
        self, task: HazardTask, grid: RasterGrid, *, exclude_id: str | None = None
    ) -> ReferenceLayer | None:
        if task is not HazardTask.FLOOD:
            return None
        try:
            bounds = bounds_wgs84(grid)
        except Exception as exc:
            raise ReferenceUnavailable(f"No se pudieron obtener bounds: {exc}") from exc

        cache_key = hashlib.sha1(
            f"{bounds.west:.3f},{bounds.south:.3f},{bounds.east:.3f},{bounds.north:.3f},"
            f"{grid.width}x{grid.height},{grid.crs},{self.permanent_pct}".encode()
        ).hexdigest()[:16]
        cache_path = self.cache_dir / f"{cache_key}.tif"

        if cache_path.is_file():
            occ, valid = self._read_cached(cache_path, grid)
        else:
            occ, valid = self._fetch_and_cache(bounds, grid, cache_path)

        permanent = (occ >= self.permanent_pct) & valid
        return ReferenceLayer(
            mask=permanent,
            valid=valid,
            source="jrc_gsw_v1_4",
            reference_id=None,
            reference_dates=(),
        )

    def _read_cached(self, path: Path, grid: RasterGrid) -> tuple[np.ndarray, np.ndarray]:
        rasterio = _import_rasterio()
        with rasterio.open(path) as src:
            data = src.read(1)
            return reproject_uint8(data, src.transform, src.crs, JRC_NODATA, grid)

    def _fetch_and_cache(
        self, bounds: GeoBounds, grid: RasterGrid, cache_path: Path
    ) -> tuple[np.ndarray, np.ndarray]:
        rasterio = _import_rasterio()
        names = tiles_for_bounds(bounds)
        if not names:
            raise ReferenceUnavailable("Ningún tile JRC para esos bounds")

        # Mosaic de ventanas en WGS84, luego reproyectar a la grilla
        windows = []
        for name in names:
            url = f"/vsicurl/{tile_url(name)}"
            try:
                arr, transform, crs = self._read_window(url, bounds)
            except Exception as exc:
                raise ReferenceUnavailable(f"JRC no respondió ({name}): {exc}") from exc
            windows.append((arr, transform, crs))

        # Un solo tile es el caso habitual
        arr, transform, crs = windows[0]
        if len(windows) > 1:
            arr, transform, crs = self._merge_windows(windows, bounds)

        # Guardar recorte en caché (EPSG:4326)
        profile = {
            "driver": "GTiff",
            "height": arr.shape[0],
            "width": arr.shape[1],
            "count": 1,
            "dtype": "uint8",
            "crs": crs,
            "transform": transform,
            "nodata": JRC_NODATA,
            "compress": "lzw",
        }
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(cache_path, "w", **profile) as dst:
            dst.write(arr, 1)

        return reproject_uint8(arr, transform, crs, JRC_NODATA, grid)

    def _read_window(self, url: str, bounds: GeoBounds):
        """Lee solo la ventana de bounds. Se monkeypatchea en tests."""
        rasterio = _import_rasterio()
        from rasterio.windows import from_bounds  # noqa: PLC0415

        with rasterio.Env(
            GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
            CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
            GDAL_HTTP_TIMEOUT=str(self.timeout_s),
        ):
            with rasterio.open(url) as src:
                window = from_bounds(
                    bounds.west, bounds.south, bounds.east, bounds.north, src.transform
                )
                window = window.round_lengths().round_offsets()
                data = src.read(1, window=window, boundless=True, fill_value=JRC_NODATA)
                transform = src.window_transform(window)
                return data, transform, src.crs

    def _merge_windows(self, windows, bounds: GeoBounds):
        """Fusiona varios recortes en una grilla WGS84 a ~0.00025° (~30 m)."""
        rasterio = _import_rasterio()
        res = 0.00025
        width = max(1, int(math.ceil((bounds.east - bounds.west) / res)))
        height = max(1, int(math.ceil((bounds.north - bounds.south) / res)))
        transform = rasterio.transform.from_bounds(
            bounds.west, bounds.south, bounds.east, bounds.north, width, height
        )
        mosaic = np.full((height, width), JRC_NODATA, dtype=np.uint8)
        for arr, src_transform, src_crs in windows:
            reprojected, _ = reproject_uint8(
                arr,
                src_transform,
                src_crs,
                JRC_NODATA,
                RasterGrid(
                    crs="EPSG:4326",
                    transform=(
                        float(transform.a),
                        float(transform.b),
                        float(transform.c),
                        float(transform.d),
                        float(transform.e),
                        float(transform.f),
                    ),
                    width=width,
                    height=height,
                ),
            )
            fill = mosaic == JRC_NODATA
            mosaic[fill] = reprojected[fill]
        return mosaic, transform, "EPSG:4326"


def _import_rasterio():
    try:
        import rasterio  # noqa: PLC0415
    except ImportError as exc:
        raise ReferenceUnavailable("rasterio no está instalado") from exc
    return rasterio
