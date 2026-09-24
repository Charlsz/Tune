"""Segmentación con los checkpoints Prithvi-EO 2.0 publicados por IBM-NASA en Hugging Face.

Adapta el ``inference.py`` oficial de cada repo (sliding window 512x512 vía
``terratorch.cli_tools.LightningInferenceModel``). No se entrena nada: se descargan
config + pesos y se corre inferencia. Requiere el extra ``training`` (torch, terratorch,
rasterio); los imports pesados son perezosos para que la API arranque sin ellos.
"""

from __future__ import annotations

import logging
import re
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np

from tune.domain.analysis import GeoBounds, HazardTask, SegmentationOutput

log = logging.getLogger(__name__)

NO_DATA = -9999
NO_DATA_FLOAT = 0.0001
PRITHVI_BANDS = 6
# ~8000x8000. Por encima, el raster en float32 más las ventanas de 512 pasa de
# varios GB y el contenedor muere por OOM en lugar de responder.
MAX_PIXELS = 64_000_000


@dataclass(frozen=True)
class ModelCard:
    repo_id: str
    config_file: str
    checkpoint_file: str
    class_names: tuple[str, ...]
    positive_class: int = 1
    img_size: int = 512
    # Índices 0-based de las 6 bandas Prithvi en un raster con MÁS de 6 bandas
    # (p. ej. Sentinel-2 L1C con 13). Si el raster ya trae 6, se usa tal cual.
    wide_input_indices: tuple[int, ...] | None = None
    uses_coords: bool = False


MODEL_CARDS: dict[HazardTask, ModelCard] = {
    HazardTask.FLOOD: ModelCard(
        repo_id="ibm-nasa-geospatial/Prithvi-EO-2.0-300M-TL-Sen1Floods11",
        config_file="config.yaml",
        checkpoint_file="Prithvi-EO-V2-300M-TL-Sen1Floods11.pt",
        class_names=("No water", "Water / flood"),
        wide_input_indices=(1, 2, 3, 8, 11, 12),
        uses_coords=True,
    ),
    HazardTask.BURN_SCAR: ModelCard(
        repo_id="ibm-nasa-geospatial/Prithvi-EO-2.0-300M-BurnScars",
        config_file="burn_scars_config.yaml",
        checkpoint_file="Prithvi_EO_V2_300M_BurnScars.pt",
        class_names=("Not burned", "Burn scar"),
    ),
}


class PrithviSegmenter:
    """Un modelo cargado por tarea (carga perezosa, cacheada en la instancia)."""

    def __init__(self, device: str | None = None) -> None:
        self._device = device
        self._models: dict[HazardTask, Any] = {}
        self._configs: dict[HazardTask, dict[str, Any]] = {}
        # La API corre segment() en un threadpool: dos requests simultáneos no
        # deben descargar ni cargar el mismo checkpoint dos veces.
        self._load_lock = threading.Lock()

    def segment(self, geotiff: Path, task: HazardTask) -> SegmentationOutput:
        torch = _import("torch")
        card = MODEL_CARDS[task]
        model = self._model(task)
        cfg = self._configs[task]

        raster, meta, bounds, crs, pixel_area = read_geotiff(geotiff)
        data = select_prithvi_bands(raster, card)
        valid = np.all(data != NO_DATA, axis=0)
        data = data.astype("float32")
        if data[valid].mean() > 1:
            data = data / 10000.0  # reflectancia 0-1, como el script oficial

        # (bands, H, W) -> (1, C, T=1, H, W)
        x = data[:, None, :, :][None, ...]
        temporal = _temporal_coords(geotiff.name) if card.uses_coords else None
        location = _location_coords(geotiff) if card.uses_coords else None

        with torch.no_grad():
            mask = sliding_window_predict(
                x, model.model, model.datamodule, card.img_size, temporal, location
            )

        return SegmentationOutput(
            mask=mask.astype(np.uint8),
            valid=valid,
            model_id=card.repo_id,
            positive_class=card.positive_class,
            class_names=card.class_names,
            crs=crs,
            bounds=bounds,
            pixel_area_m2=pixel_area,
            raster_meta=meta,
            rgb_preview=rgb_preview(data, valid, rgb_indices_from_config(cfg)),
        )

    def _model(self, task: HazardTask):
        if task in self._models:
            return self._models[task]
        with self._load_lock:
            if task in self._models:
                return self._models[task]
            return self._load(task)

    def _load(self, task: HazardTask):
        _patch_torch_mps()
        yaml = _import("yaml")
        hub = _import("huggingface_hub")
        cli_tools = _import("terratorch.cli_tools")
        card = MODEL_CARDS[task]
        log.info("Descargando %s (config + pesos, cache HF)", card.repo_id)
        cfg_path = hub.hf_hub_download(card.repo_id, card.config_file)
        ckpt_path = hub.hf_hub_download(card.repo_id, card.checkpoint_file)
        try:
            model = cli_tools.LightningInferenceModel.from_config(cfg_path, ckpt_path)
        except Exception as exc:
            # jsonargparse/Lightning a veces envuelven el fallo de mps/CUDA como TypeError.
            raise RuntimeError(f"No se pudo cargar el checkpoint Prithvi: {exc}") from exc
        model.model.eval()
        if self._device:
            model.model.to(self._device)
        self._models[task] = model
        self._configs[task] = yaml.safe_load(Path(cfg_path).read_text(encoding="utf-8"))
        return model


def _patch_torch_mps() -> None:
    """La imagen CUDA de torch 2.4 trae torch.mps sin is_available; Lightning lo pide."""
    torch = _import("torch")
    mps = getattr(torch, "mps", None)
    if mps is None:
        return
    if not hasattr(mps, "is_available"):
        mps.is_available = lambda: False  # type: ignore[attr-defined]


# --- raster helpers -------------------------------------------------------------


def read_geotiff(path: Path):
    """(bands, H, W), meta, bounds EPSG:4326 | None, crs | None, área de píxel m² | None."""
    rasterio = _import("rasterio")
    from rasterio.warp import transform_bounds  # noqa: PLC0415

    with rasterio.open(path) as src:
        if src.width * src.height > MAX_PIXELS:
            raise ValueError(
                f"Raster de {src.width}x{src.height} píxeles; el máximo es "
                f"{MAX_PIXELS:,} píxeles. Recorta la escena antes de analizarla."
            )
        img = src.read()
        meta = dict(src.meta)
        crs = src.crs.to_string() if src.crs else None
        bounds = None
        pixel_area = None
        if src.crs is not None:
            try:
                w, s, e, n = transform_bounds(src.crs, "EPSG:4326", *src.bounds, densify_pts=21)
                bounds = GeoBounds(west=w, south=s, east=e, north=n)
            except Exception as exc:  # CRS raro / sin transformación
                log.warning("No se pudo reproyectar bounds: %s", exc)
            pixel_area = _pixel_area_m2(src, bounds)
    return img, meta, bounds, crs, pixel_area


def _pixel_area_m2(src, bounds: GeoBounds | None) -> float | None:
    xres, yres = abs(src.transform.a), abs(src.transform.e)
    if src.crs is None:
        return None
    if src.crs.is_projected:
        return float(xres * yres)  # unidades lineales (m en UTM)
    if bounds is None:
        return None
    # Geográfico: aproximación por latitud media (suficiente para un % de área)
    lat = np.deg2rad((bounds.north + bounds.south) / 2)
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * float(np.cos(lat))
    return float(xres * m_per_deg_lon * yres * m_per_deg_lat)


def select_prithvi_bands(raster: np.ndarray, card: ModelCard) -> np.ndarray:
    n = raster.shape[0]
    if n == PRITHVI_BANDS:
        return raster
    if card.wide_input_indices and n > max(card.wide_input_indices):
        return raster[list(card.wide_input_indices)]
    raise ValueError(
        f"El raster tiene {n} bandas; se esperan {PRITHVI_BANDS} "
        "(BLUE, GREEN, RED, NIR_NARROW, SWIR_1, SWIR_2)"
        + (
            f" o un Sentinel-2 L1C completo (>{max(card.wide_input_indices)} bandas)."
            if card.wide_input_indices
            else "."
        )
    )


def rgb_indices_from_config(cfg: dict[str, Any]) -> tuple[int, int, int]:
    init = cfg.get("data", {}).get("init_args", {})
    if "rgb_indices" in init:
        r, g, b = init["rgb_indices"][:3]
        return int(r), int(g), int(b)
    bands = init.get("bands") or init.get("output_bands") or []
    try:
        return bands.index("RED"), bands.index("GREEN"), bands.index("BLUE")
    except ValueError:
        return 2, 1, 0


def rgb_preview(data: np.ndarray, valid: np.ndarray, rgb: tuple[int, int, int]) -> np.ndarray:
    """(3, H, W) uint8 con estiramiento al percentil 99 (como el script oficial)."""
    img = data[list(rgb)]
    if valid.any():
        max_value = max(0.3, float(np.percentile(img[:, valid], 99)))
    else:
        max_value = 1.0
    img = np.clip(img / max_value, 0, 1)
    img[:, ~valid] = 0
    return (img * 255).astype(np.uint8)


# --- inference core (portado del inference.py oficial) ----------------------------


def sliding_window_predict(x: np.ndarray, model, datamodule, img_size: int, temporal, location):
    torch = _import("torch")
    einops = _import("einops")

    _, _, _, h, w = x.shape
    pad_h = (img_size - (h % img_size)) % img_size
    pad_w = (img_size - (w % img_size)) % img_size
    x = np.pad(x, ((0, 0), (0, 0), (0, 0), (0, pad_h), (0, pad_w)), mode="reflect")

    batch = torch.tensor(x)
    windows = batch.unfold(3, img_size, img_size).unfold(4, img_size, img_size)
    h1, w1 = windows.shape[3:5]
    windows = einops.rearrange(
        windows, "b c t h1 w1 h w -> (b h1 w1) c t h w", h=img_size, w=img_size
    )

    device = next(model.parameters()).device
    kwargs: dict[str, Any] = {}
    if temporal is not None:
        kwargs["temporal_coords"] = torch.tensor(temporal, device=device).unsqueeze(0)
    if location is not None:
        kwargs["location_coords"] = torch.tensor(location, device=device).unsqueeze(0)

    preds = []
    for win in windows:
        sample = datamodule.test_transform(image=win.squeeze().numpy().transpose(1, 2, 0))
        img = sample["image"]
        if img.dim() == 3:
            img = img.unsqueeze(0)
        sample["image"] = img
        img = datamodule.aug(sample)["image"].to(device)
        out = model(img, **kwargs).output.detach().cpu()
        y_hat = out.argmax(dim=1)
        y_hat = torch.nn.functional.interpolate(
            y_hat.unsqueeze(1).float(), size=img_size, mode="nearest"
        )
        preds.append(y_hat)

    pred = torch.concat(preds, dim=0)
    pred = einops.rearrange(
        pred, "(b h1 w1) c h w -> b c (h1 h) (w1 w)", h=img_size, w=img_size, b=1, c=1, h1=h1, w1=w1
    )
    return pred[0, 0, :h, :w].numpy()


def _temporal_coords(filename: str) -> list[list[int]] | None:
    m = re.search(r"(\d{7,8}T\d{6})", filename)
    if not m:
        return None
    stamp = m.group(1).split("T")[0]
    year = int(stamp[:4])
    rest = stamp[4:]
    if len(rest) == 3:  # YYYYDDD (día juliano)
        return [[year, int(rest)]]
    return [[year, datetime.strptime(stamp, "%Y%m%d").timetuple().tm_yday]]


def _location_coords(path: Path) -> list[float] | None:
    rasterio = _import("rasterio")
    try:
        with rasterio.open(path) as src:
            lon, lat = src.lnglat()
        return [float(lon), float(lat)]
    except Exception:
        return None


def _import(name: str):
    import importlib  # noqa: PLC0415

    try:
        return importlib.import_module(name)
    except ImportError as exc:
        raise ImportError(
            f"'{name}' no está instalado. La inferencia Prithvi requiere el extra training: "
            'pip install -e ".[training]"  (o usar la imagen Docker eo-api).'
        ) from exc
