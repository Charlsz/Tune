"""Catálogo Sentinel-2 L2A vía STAC Earth Search (Element84)."""

from __future__ import annotations

import hashlib
import json
import logging
import math
import re
from datetime import date
from pathlib import Path

import numpy as np

from tune.domain.analysis import SceneItem

log = logging.getLogger(__name__)

STAC_URL = "https://earth-search.aws.element84.com/v1"
COLLECTION = "sentinel-2-l2a"
BAND_KEYS = ("blue", "green", "red", "nir08", "swir16", "swir22")
RGB_KEYS = ("red", "green", "blue")
SCL_CLOUD = {3, 8, 9, 10, 11}
OFFSET_CUTOFF = date(2022, 1, 25)
TARGET_RES_M = 20.0
PREVIEW_RES_M = 10.0
PREVIEW_MAX_EDGE = 2048


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
            scene_bbox = (float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3]))
            items.append(
                SceneItem(
                    id=item.id,
                    datetime=str(dt)[:19],
                    cloud_cover=cloud,
                    bbox=scene_bbox,
                    thumbnail=thumb,
                    aoi_cover=footprint_cover(bbox, getattr(item, "geometry", None)),
                )
            )
        # Cronológico: inicio → fin de la ventana pedida.
        items.sort(key=lambda s: s.datetime)
        return items

    def fetch_six_bands(
        self,
        item_id: str,
        bbox: tuple[float, float, float, float],
        dest: Path,
        *,
        max_cloud: float = 40.0,
        on_progress=None,
    ) -> Path:
        """Escribe un GeoTIFF de 6 bandas a 20 m con nodata en nubes.

        ``eo:cloud_cover`` del catálogo es de toda la escena (~100 km). Aquí se mide
        la nubosidad SCL solo en el recorte pedido; por eso puede diferir del % de la lista.

        ``on_progress(loaded, total)`` se llama al terminar cada banda + SCL (total=7).
        """
        client = self._client()
        results = list(client.search(collections=[COLLECTION], ids=[item_id], max_items=1).items())
        if not results:
            raise CatalogError(f"Escena no encontrada: {item_id}")
        item = results[0]

        props = item.properties or {}
        dt_str = str(props.get("datetime") or item.datetime.isoformat())
        acquired = date.fromisoformat(dt_str[:10])
        apply_offset = acquired >= OFFSET_CUTOFF
        tile_cloud = float(props.get("eo:cloud_cover", -1))

        total_steps = len(BAND_KEYS) + 1  # 6 bandas + SCL
        arrays = []
        transform = None
        crs = None
        for i, key in enumerate(BAND_KEYS):
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
            if on_progress is not None:
                on_progress(i + 1, total_steps)

        scl_asset = item.assets.get("scl")
        if scl_asset is None:
            raise CatalogError("La escena no trae SCL")
        scl, _, _ = self._read_window(scl_asset.href, bbox, TARGET_RES_M)
        if on_progress is not None:
            on_progress(total_steps, total_steps)
        h = min(a.shape[0] for a in arrays + [scl])
        w = min(a.shape[1] for a in arrays + [scl])
        stack = np.stack([a[:h, :w] for a in arrays], axis=0)
        scl = scl[:h, :w]
        cloudy = np.isin(scl, list(SCL_CLOUD))
        cloud_frac = float(cloudy.mean()) if cloudy.size else 0.0
        # Umbral del usuario (mismo filtro de búsqueda). Nunca rechazar por debajo del
        # valor pedido; nubes se marcan nodata. Tope duro 90 %: recorte casi inútil.
        limit = min(max(float(max_cloud), 0.0), 90.0) / 100.0
        hard_cap = 0.90
        if cloud_frac > hard_cap:
            raise CatalogError(
                f"El recorte tiene {cloud_frac:.0%} de nubes (capa SCL). "
                "Casi no queda superficie usable. Elige otra fecha o mueve el punto."
            )
        if cloud_frac > limit:
            tile_note = (
                f" La escena completa reportaba {tile_cloud:.0f}% de nubes, pero eso es "
                "un promedio de ~100 km, no de tu recorte."
                if tile_cloud >= 0
                else ""
            )
            need = max(1, int(math.ceil(cloud_frac * 100)))
            raise CatalogError(
                f"Nubosidad en tu recorte: {cloud_frac:.0%} (límite actual {max_cloud:.0f}%)."
                f"{tile_note} "
                f"Sube «Nubes máx.» al menos a {need} o elige otra fecha."
            )
        stack[:, cloudy] = -9999

        stamp = acquired.strftime("%Y%m%dT120000")
        dest.mkdir(parents=True, exist_ok=True)
        out = dest / f"S2_{stamp}_{item_id[-8:]}.tif"
        self._write_geotiff(out, stack, transform, crs, acquired)
        return out

    def render_aoi_preview(
        self,
        item_id: str,
        bbox: tuple[float, float, float, float],
        dest_dir: Path,
        *,
        max_edge_px: int = PREVIEW_MAX_EDGE,
        res_m: float = PREVIEW_RES_M,
    ) -> tuple[Path, tuple[float, float, float, float]]:
        """PNG RGBA del recorte AOI (visual o B04/B03/B02) + bounds WGS84.

        Cache en ``dest_dir`` por item_id + bbox. Fuera de cobertura → alpha 0.
        """
        dest_dir = Path(dest_dir)
        dest_dir.mkdir(parents=True, exist_ok=True)
        key = _preview_cache_key(item_id, bbox, res_m=res_m, max_edge=max_edge_px)
        png_path = dest_dir / f"{key}.png"
        meta_path = dest_dir / f"{key}.json"
        if png_path.is_file() and meta_path.is_file():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            bounds = tuple(float(x) for x in meta["bounds"])
            return png_path, (bounds[0], bounds[1], bounds[2], bounds[3])

        client = self._client()
        results = list(client.search(collections=[COLLECTION], ids=[item_id], max_items=1).items())
        if not results:
            raise CatalogError(f"Escena no encontrada: {item_id}")
        item = results[0]

        props = item.properties or {}
        dt_str = str(props.get("datetime") or item.datetime.isoformat())
        acquired = date.fromisoformat(dt_str[:10])
        apply_offset = acquired >= OFFSET_CUTOFF

        visual = item.assets.get("visual")
        if visual is not None:
            rgb, valid = self._read_rgb_window(visual.href, bbox, res_m, indexes=(1, 2, 3))
            # visual suele ser uint8 ya; si no, estirar
            if rgb.dtype != np.uint8:
                rgb = _stretch_rgb(rgb, valid)
        else:
            bands = []
            valid = None
            for key in RGB_KEYS:
                asset = item.assets.get(key)
                if asset is None:
                    raise CatalogError(
                        f"La escena no trae asset visual ni banda {key} para preview"
                    )
                data, _, _ = self._read_window(asset.href, bbox, res_m)
                data = data.astype(np.float32)
                if apply_offset:
                    data = np.clip(data - 1000.0, 0, None)
                band_valid = data > 0
                valid = band_valid if valid is None else (valid & band_valid)
                bands.append(data)
            rgb = _stretch_rgb(np.stack(bands, axis=0), valid)

        h, w = rgb.shape[1], rgb.shape[2]
        # Limitar tamaño de borde largo
        edge = max(h, w)
        if edge > max_edge_px:
            scale = max_edge_px / edge
            new_h = max(1, int(round(h * scale)))
            new_w = max(1, int(round(w * scale)))
            rgb = _resize_rgb(rgb, new_h, new_w)
            if valid is not None:
                valid = _resize_mask(valid, new_h, new_w)

        if valid is None:
            valid = np.any(rgb > 0, axis=0)
        rgba = np.zeros((rgb.shape[1], rgb.shape[2], 4), dtype=np.uint8)
        rgba[..., :3] = np.transpose(rgb, (1, 2, 0))
        rgba[..., 3] = np.where(valid, 255, 0).astype(np.uint8)

        from PIL import Image  # noqa: PLC0415

        Image.fromarray(rgba, mode="RGBA").save(png_path, optimize=True)
        meta_path.write_text(
            json.dumps({"item_id": item_id, "bounds": list(bbox)}, indent=0),
            encoding="utf-8",
        )
        return png_path, bbox

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
                        resampling=Resampling.lanczos,
                    )
                    return dst, new_tf, src.crs
                return data, transform, src.crs

    def _read_rgb_window(
        self,
        href: str,
        bbox,
        res_m: float,
        indexes: tuple[int, int, int] = (1, 2, 3),
    ) -> tuple[np.ndarray, np.ndarray]:
        """Lee 3 bandas RGB remuestreadas. Devuelve (3,H,W) uint8/float y máscara válida."""
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
                data = src.read(indexes, window=window, boundless=True, fill_value=0)
                transform = src.window_transform(window)
                if abs(abs(transform.a) - res_m) > 0.5:
                    new_h = max(1, int(round(data.shape[1] * abs(transform.e) / res_m)))
                    new_w = max(1, int(round(data.shape[2] * abs(transform.a) / res_m)))
                    dst = np.zeros((data.shape[0], new_h, new_w), dtype=data.dtype)
                    new_tf = rasterio.Affine(res_m, 0, transform.c, 0, -res_m, transform.f)
                    for i in range(data.shape[0]):
                        reproject(
                            source=data[i],
                            destination=dst[i],
                            src_transform=transform,
                            src_crs=src.crs,
                            dst_transform=new_tf,
                            dst_crs=src.crs,
                            resampling=Resampling.lanczos,
                        )
                    data = dst
                valid = np.any(data > 0, axis=0)
                if data.dtype == np.uint8:
                    return data, valid
                return data.astype(np.float32), valid

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


def footprint_cover(
    aoi: tuple[float, float, float, float],
    geometry: dict | None,
) -> float | None:
    """Fracción del recorte que pisa la huella (polígono), no el bbox que la envuelve.

    Un Sentinel-2 cabe en un rectángulo casi completo y aun así deja fuera del
    recorte la franja que no fotografió. Sin geometría no hay cifra honesta.
    """
    rings = _footprint_rings(geometry)
    if not rings:
        return None
    west, south, east, north = aoi
    aoi_area = _ring_area([(west, south), (east, south), (east, north), (west, north)])
    if aoi_area <= 0:
        return None
    covered = 0.0
    for ring in rings:
        covered += _ring_area(_clip_to_rect(ring, west, south, east, north))
    return max(0.0, min(1.0, covered / aoi_area))


def _footprint_rings(geometry: dict | None) -> list[list[tuple[float, float]]]:
    if not isinstance(geometry, dict):
        return []
    kind = geometry.get("type")
    coords = geometry.get("coordinates")
    if kind == "Polygon" and coords:
        return [_ring(coords[0])]
    if kind == "MultiPolygon" and coords:
        return [_ring(poly[0]) for poly in coords if poly]
    return []


def _ring(raw) -> list[tuple[float, float]]:
    points = [(float(x), float(y)) for x, y in raw]
    if len(points) > 1 and points[0] == points[-1]:
        points = points[:-1]
    return points


def _ring_area(ring: list[tuple[float, float]]) -> float:
    if len(ring) < 3:
        return 0.0
    area = 0.0
    for i, (x1, y1) in enumerate(ring):
        x2, y2 = ring[(i + 1) % len(ring)]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def _clip_to_rect(
    ring: list[tuple[float, float]],
    west: float,
    south: float,
    east: float,
    north: float,
) -> list[tuple[float, float]]:
    """Sutherland–Hodgman. El recorte es convexo; la huella puede no serlo."""

    def clip(points, inside, cross):
        if not points:
            return []
        out: list[tuple[float, float]] = []
        prev = points[-1]
        prev_in = inside(prev)
        for cur in points:
            cur_in = inside(cur)
            if cur_in:
                if not prev_in:
                    out.append(cross(prev, cur))
                out.append(cur)
            elif prev_in:
                out.append(cross(prev, cur))
            prev, prev_in = cur, cur_in
        return out

    def hit_x(a, b, x):
        dx = b[0] - a[0]
        if abs(dx) < 1e-15:
            return (x, a[1])
        t = (x - a[0]) / dx
        return (x, a[1] + t * (b[1] - a[1]))

    def hit_y(a, b, y):
        dy = b[1] - a[1]
        if abs(dy) < 1e-15:
            return (a[0], y)
        t = (y - a[1]) / dy
        return (a[0] + t * (b[0] - a[0]), y)

    pts = clip(ring, lambda p: p[0] >= west - 1e-12, lambda a, b: hit_x(a, b, west))
    pts = clip(pts, lambda p: p[0] <= east + 1e-12, lambda a, b: hit_x(a, b, east))
    pts = clip(pts, lambda p: p[1] >= south - 1e-12, lambda a, b: hit_y(a, b, south))
    pts = clip(pts, lambda p: p[1] <= north + 1e-12, lambda a, b: hit_y(a, b, north))
    return pts


def _preview_cache_key(
    item_id: str,
    bbox: tuple[float, float, float, float],
    *,
    res_m: float = PREVIEW_RES_M,
    max_edge: int = PREVIEW_MAX_EDGE,
) -> str:
    """Incluye resolución y tope: un PNG de 40 m no se reutiliza como si fuera de 10 m."""
    safe_id = re.sub(r"[^\w.-]+", "_", item_id)[:120]
    raw = f"{','.join(f'{x:.6f}' for x in bbox)}|{res_m:.1f}|{max_edge}"
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]
    return f"{safe_id}_{digest}"


def _stretch_rgb(stack: np.ndarray, valid: np.ndarray | None) -> np.ndarray:
    """(3,H,W) → uint8 con estiramiento por percentiles en píxeles válidos."""
    out = np.zeros((3, stack.shape[1], stack.shape[2]), dtype=np.uint8)
    mask = valid if valid is not None else np.any(stack > 0, axis=0)
    for i in range(3):
        band = stack[i].astype(np.float32)
        vals = band[mask] if mask.any() else band.ravel()
        if vals.size == 0:
            continue
        lo, hi = np.percentile(vals, (2, 98))
        if hi <= lo:
            hi = lo + 1.0
        scaled = np.clip((band - lo) / (hi - lo), 0, 1)
        out[i] = (scaled * 255).astype(np.uint8)
    return out


def _resize_rgb(rgb: np.ndarray, height: int, width: int) -> np.ndarray:
    from PIL import Image  # noqa: PLC0415

    planes = []
    for i in range(rgb.shape[0]):
        img = Image.fromarray(rgb[i], mode="L")
        planes.append(np.asarray(img.resize((width, height), Image.Resampling.LANCZOS)))
    return np.stack(planes, axis=0)


def _resize_mask(mask: np.ndarray, height: int, width: int) -> np.ndarray:
    from PIL import Image  # noqa: PLC0415

    img = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
    resized = np.asarray(img.resize((width, height), Image.Resampling.NEAREST))
    return resized > 127
