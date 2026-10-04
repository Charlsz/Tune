"""Catálogo Sentinel-2 L2A vía STAC Earth Search (Element84)."""

from __future__ import annotations

import logging
import math
from datetime import date
from pathlib import Path

import numpy as np

from tune.domain.analysis import SceneItem

log = logging.getLogger(__name__)

STAC_URL = "https://earth-search.aws.element84.com/v1"
COLLECTION = "sentinel-2-l2a"
BAND_KEYS = ("blue", "green", "red", "nir08", "swir16", "swir22")
SCL_CLOUD = {3, 8, 9, 10, 11}
OFFSET_CUTOFF = date(2022, 1, 25)
TARGET_RES_M = 20.0


class CatalogError(RuntimeError):
    """Fallo de búsqueda o descarga del catálogo."""


def bbox_from_point(lat: float, lon: float, side_km: float) -> tuple[float, float, float, float]:
    """Caja WGS84 centrada en (lat, lon) de lado side_km."""
    dlat = (side_km / 2) / 110.57
    dlon = (side_km / 2) / (111.32 * max(0.2, math.cos(math.radians(lat))))
    return (lon - dlon, lat - dlat, lon + dlon, lat + dlat)


class StacCatalog:
    """Earth Search v1. Los tests monkeypatchean ``_client`` y ``_read_window``."""

    def __init__(self, *, max_km: float = 30.0) -> None:
        self.max_km = max_km

    def search(
        self,
        lat: float,
        lon: float,
        start: str,
        end: str,
        *,
        max_cloud: float = 40.0,
        side_km: float = 20.0,
    ) -> list[SceneItem]:
        if side_km > self.max_km:
            raise CatalogError(f"side_km máximo es {self.max_km}")
        bbox = bbox_from_point(lat, lon, side_km)
        client = self._client()
        search = client.search(
            collections=[COLLECTION],
            bbox=bbox,
            datetime=f"{start}/{end}",
            query={"eo:cloud_cover": {"lt": max_cloud}},
            max_items=50,
        )
        items = []
        for item in search.items():
            props = item.properties or {}
            cloud = float(props.get("eo:cloud_cover", 100))
            if cloud >= max_cloud:
                continue
            dt = props.get("datetime") or (item.datetime.isoformat() if item.datetime else start)
            thumb = None
            if "thumbnail" in item.assets:
                thumb = item.assets["thumbnail"].href
            bb = item.bbox or bbox
            items.append(
                SceneItem(
                    id=item.id,
                    datetime=str(dt)[:19],
                    cloud_cover=cloud,
                    bbox=(float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])),
                    thumbnail=thumb,
                )
            )
        items.sort(key=lambda s: s.datetime, reverse=True)
        return items

    def fetch_six_bands(
        self, item_id: str, bbox: tuple[float, float, float, float], dest: Path
    ) -> Path:
        """Escribe un GeoTIFF de 6 bandas a 20 m con nodata en nubes."""
        client = self._client()
        results = list(client.search(collections=[COLLECTION], ids=[item_id], max_items=1).items())
        if not results:
            raise CatalogError(f"Escena no encontrada: {item_id}")
        item = results[0]

        props = item.properties or {}
        dt_str = str(props.get("datetime") or item.datetime.isoformat())
        acquired = date.fromisoformat(dt_str[:10])
        apply_offset = acquired >= OFFSET_CUTOFF

        arrays = []
        transform = None
        crs = None
        for key in BAND_KEYS:
            asset = item.assets.get(key)
            if asset is None:
                raise CatalogError(f"La escena no trae la banda {key}")
            data, tf, band_crs = self._read_window(asset.href, bbox, TARGET_RES_M)
            data = data.astype(np.float32)
            if apply_offset:
                data = np.clip(data - 1000.0, 0, None)
            arrays.append(data)
            transform = tf
            crs = band_crs

        scl_asset = item.assets.get("scl")
        if scl_asset is None:
            raise CatalogError("La escena no trae SCL")
        scl, _, _ = self._read_window(scl_asset.href, bbox, TARGET_RES_M)
        h = min(a.shape[0] for a in arrays + [scl])
        w = min(a.shape[1] for a in arrays + [scl])
        stack = np.stack([a[:h, :w] for a in arrays], axis=0)
        scl = scl[:h, :w]
        cloudy = np.isin(scl, list(SCL_CLOUD))
        cloud_frac = float(cloudy.mean()) if cloudy.size else 0.0
        if cloud_frac > 0.4:
            raise CatalogError(
                f"Nubosidad en el recorte {cloud_frac:.0%} supera el 40 %. Elige otra fecha."
            )
        stack[:, cloudy] = -9999

        stamp = acquired.strftime("%Y%m%dT120000")
        dest.mkdir(parents=True, exist_ok=True)
        out = dest / f"S2_{stamp}_{item_id[-8:]}.tif"
        self._write_geotiff(out, stack, transform, crs, acquired)
        return out

    def _client(self):
        try:
            from pystac_client import Client  # noqa: PLC0415
        except ImportError as exc:
            raise CatalogError(
                'pystac-client no está instalado. pip install -e ".[api]" o training.'
            ) from exc
        return Client.open(STAC_URL)

    def _read_window(self, href: str, bbox, res_m: float):
        """Lee una ventana remuestreada. Se monkeypatchea en tests."""
        import rasterio
        from rasterio.enums import Resampling
        from rasterio.warp import reproject, transform_bounds
        from rasterio.windows import from_bounds

        url = href if href.startswith(("/vsi", "file:")) else f"/vsicurl/{href}"
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
            with rasterio.open(url) as src:
                west, south, east, north = bbox
                if src.crs and src.crs.to_epsg() != 4326:
                    left, bottom, right, top = transform_bounds(
                        "EPSG:4326", src.crs, west, south, east, north
                    )
                else:
                    left, bottom, right, top = west, south, east, north
                window = from_bounds(left, bottom, right, top, src.transform)
                window = window.round_lengths().round_offsets()
                data = src.read(1, window=window, boundless=True, fill_value=0)
                transform = src.window_transform(window)
                if abs(abs(transform.a) - res_m) > 0.5:
                    new_h = max(1, int(round(data.shape[0] * abs(transform.e) / res_m)))
                    new_w = max(1, int(round(data.shape[1] * abs(transform.a) / res_m)))
                    dst = np.zeros((new_h, new_w), dtype=data.dtype)
                    new_tf = rasterio.Affine(res_m, 0, transform.c, 0, -res_m, transform.f)
                    reproject(
                        source=data,
                        destination=dst,
                        src_transform=transform,
                        src_crs=src.crs,
                        dst_transform=new_tf,
                        dst_crs=src.crs,
                        resampling=Resampling.bilinear,
                    )
                    return dst, new_tf, src.crs
                return data, transform, src.crs

    def _write_geotiff(self, path, stack, transform, crs, acquired: date) -> None:
        import rasterio

        profile = {
            "driver": "GTiff",
            "height": stack.shape[1],
            "width": stack.shape[2],
            "count": 6,
            "dtype": "float32",
            "crs": crs,
            "transform": transform,
            "nodata": -9999,
            "compress": "lzw",
        }
        with rasterio.open(path, "w", **profile) as dst:
            dst.write(stack)
            dst.update_tags(
                ACQUISITION_DATE=acquired.isoformat(),
                SENSING_TIME=acquired.isoformat() + "T12:00:00",
            )
