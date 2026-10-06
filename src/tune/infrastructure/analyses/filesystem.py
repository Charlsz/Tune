"""Análisis en disco: ``<root>/<id>/{analysis.json, input.tif, mask.png, preview.png, mask.tif}``.

Suficiente para la demo y el historial. Si más adelante hace falta consulta espacial,
este adaptador se reemplaza por uno PostGIS sin tocar aplicación ni interfaces.
"""

from __future__ import annotations

import json
import logging
import shutil
from dataclasses import asdict, replace
from pathlib import Path
from typing import Any

import numpy as np

from tune.domain.analysis import (
    Analysis,
    ChangeSummary,
    ExposureClass,
    ExposureSummary,
    FusionSummary,
    GeoBounds,
    HazardTask,
    SegmentationOutput,
)

log = logging.getLogger(__name__)

# RGBA de la clase positiva sobre el mapa (rojo semitransparente)
MASK_COLOR = (230, 57, 70, 170)
# Capas de cambio frente a referencia
NEW_COLOR = (230, 57, 70, 200)  # agua / cicatriz nueva
PERSISTENT_COLOR = (29, 78, 137, 160)  # permanente
RECEDED_COLOR = (148, 163, 184, 140)  # retirado
AGREE_COLOR = (21, 128, 61, 200)
TUNE_ONLY_COLOR = (230, 57, 70, 180)
EXTERNAL_ONLY_COLOR = (37, 99, 235, 180)
UNKNOWN_COLOR = (148, 163, 184, 90)


class FileAnalysisRepository:
    def __init__(self, root: Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def save(
        self,
        analysis: Analysis,
        output: SegmentationOutput,
        source: Path,
        *,
        change_layers: tuple[Any, Any, Any] | None = None,
        fusion_layers: tuple[Any, Any, Any, Any] | None = None,
    ) -> Analysis:
        folder = self.root / analysis.id
        folder.mkdir(parents=True, exist_ok=True)
        artifacts: dict[str, str] = {}

        shutil.copy2(source, folder / "input.tif")
        artifacts["input"] = "input.tif"

        write_mask_png(output, folder / "mask.png")
        artifacts["mask_png"] = "mask.png"

        if output.rgb_preview is not None:
            write_rgb_png(output.rgb_preview, output.valid, folder / "preview.png")
            artifacts["preview_png"] = "preview.png"

        if write_mask_geotiff(output, folder / "mask.tif"):
            artifacts["mask_tif"] = "mask.tif"

        if change_layers is not None:
            new, persistent, receded = change_layers
            write_change_png(new, persistent, receded, folder / "change.png")
            artifacts["change_png"] = "change.png"
            if write_reference_geotiff(output, persistent | receded, folder / "reference.tif"):
                artifacts["reference_tif"] = "reference.tif"

        if fusion_layers is not None:
            agree, only_t, only_e, unknown = fusion_layers
            write_fusion_png(agree, only_t, only_e, unknown, folder / "fusion.png")
            artifacts["fusion_png"] = "fusion.png"

        saved = replace(analysis, artifacts=artifacts)
        (folder / "analysis.json").write_text(to_json(saved), encoding="utf-8")
        return saved

    def get(self, analysis_id: str) -> Analysis:
        path = self.root / analysis_id / "analysis.json"
        if not path.is_file():
            raise KeyError(f"Análisis no encontrado: {analysis_id}")
        return from_json(path.read_text(encoding="utf-8"))

    def list(self, limit: int = 50) -> list[Analysis]:
        items = []
        for path in self.root.glob("*/analysis.json"):
            try:
                items.append(from_json(path.read_text(encoding="utf-8")))
            except (ValueError, KeyError, TypeError) as exc:
                log.warning("analysis.json inválido en %s: %s", path, exc)
        items.sort(key=lambda a: a.created_at, reverse=True)
        return items[:limit]

    def delete(self, analysis_id: str) -> None:
        folder = (self.root / analysis_id).resolve()
        if folder.parent != self.root.resolve() or not (folder / "analysis.json").is_file():
            raise KeyError(f"Análisis no encontrado: {analysis_id}")
        shutil.rmtree(folder)

    def artifact_path(self, analysis_id: str, name: str) -> Path:
        analysis = self.get(analysis_id)
        rel = analysis.artifacts.get(name)
        if rel is None:
            raise KeyError(f"Artefacto '{name}' no existe para {analysis_id}")
        return self.root / analysis_id / rel


# --- serialización ---------------------------------------------------------------


def to_json(a: Analysis) -> str:
    data = asdict(a)
    data["task"] = a.task.value
    if a.change is not None:
        data["change"]["reference_dates"] = list(a.change.reference_dates)
    if a.fusion is not None:
        data["fusion"]["sources"] = list(a.fusion.sources)
    if a.exposure is not None:
        data["exposure"]["classes"] = [c.__dict__ for c in a.exposure.classes]
    return json.dumps(data, indent=2)


def from_json(text: str) -> Analysis:
    raw = json.loads(text)
    bounds = raw.get("bounds")
    raw["bounds"] = GeoBounds(**bounds) if bounds else None
    raw["task"] = HazardTask(raw["task"])
    change = raw.get("change")
    if change:
        dates = change.get("reference_dates") or []
        change["reference_dates"] = tuple(dates)
        raw["change"] = ChangeSummary(**change)
    else:
        raw["change"] = None
    fusion = raw.get("fusion")
    if fusion:
        fusion["sources"] = tuple(fusion.get("sources") or [])
        raw["fusion"] = FusionSummary(**fusion)
    else:
        raw["fusion"] = None
    exposure = raw.get("exposure")
    if exposure:
        classes = tuple(ExposureClass(**c) for c in exposure.get("classes") or [])
        exposure["classes"] = classes
        raw["exposure"] = ExposureSummary(**exposure)
    else:
        raw["exposure"] = None
    raw.setdefault("acquired_at", None)
    raw.setdefault("metadata", {})
    return Analysis(**raw)


# --- escritura de imágenes -------------------------------------------------------


def write_mask_png(output: SegmentationOutput, path: Path) -> None:
    from PIL import Image  # noqa: PLC0415

    mask = np.asarray(output.mask)
    valid = np.asarray(output.valid, dtype=bool)
    positive = (mask == output.positive_class) & valid
    rgba = np.zeros((*mask.shape, 4), dtype=np.uint8)
    rgba[positive] = MASK_COLOR
    Image.fromarray(rgba, mode="RGBA").save(path, optimize=True)


def write_rgb_png(rgb: np.ndarray, valid: np.ndarray, path: Path) -> None:
    from PIL import Image  # noqa: PLC0415

    arr = np.asarray(rgb, dtype=np.uint8).transpose(1, 2, 0)
    alpha = (np.asarray(valid, dtype=bool) * 255).astype(np.uint8)[..., None]
    Image.fromarray(np.concatenate([arr, alpha], axis=-1), mode="RGBA").save(path, optimize=True)


def write_change_png(new: Any, persistent: Any, receded: Any, path: Path) -> None:
    from PIL import Image  # noqa: PLC0415

    n = np.asarray(new, dtype=bool)
    p = np.asarray(persistent, dtype=bool)
    r = np.asarray(receded, dtype=bool)
    rgba = np.zeros((*n.shape, 4), dtype=np.uint8)
    rgba[r] = RECEDED_COLOR
    rgba[p] = PERSISTENT_COLOR
    rgba[n] = NEW_COLOR
    Image.fromarray(rgba, mode="RGBA").save(path, optimize=True)


def write_mask_geotiff(output: SegmentationOutput, path: Path) -> bool:
    """GeoTIFF uint8 de la máscara con la georreferencia original. False si no hay rasterio."""
    try:
        import rasterio  # noqa: PLC0415
    except ImportError:
        return False
    meta = dict(output.raster_meta)
    if not meta:
        return False
    meta.update(count=1, dtype="uint8", compress="lzw", nodata=255)
    mask = np.asarray(output.mask, dtype=np.uint8).copy()
    mask[~np.asarray(output.valid, dtype=bool)] = 255
    with rasterio.open(path, "w", **meta) as dst:
        dst.write(mask, 1)
    return True


def write_fusion_png(agree: Any, only_t: Any, only_e: Any, unknown: Any, path: Path) -> None:
    from PIL import Image  # noqa: PLC0415

    a = np.asarray(agree, dtype=bool)
    t = np.asarray(only_t, dtype=bool)
    e = np.asarray(only_e, dtype=bool)
    u = np.asarray(unknown, dtype=bool)
    rgba = np.zeros((*a.shape, 4), dtype=np.uint8)
    rgba[u] = UNKNOWN_COLOR
    rgba[e] = EXTERNAL_ONLY_COLOR
    rgba[t] = TUNE_ONLY_COLOR
    rgba[a] = AGREE_COLOR
    Image.fromarray(rgba, mode="RGBA").save(path, optimize=True)


def write_reference_geotiff(output: SegmentationOutput, permanent: Any, path: Path) -> bool:
    """GeoTIFF uint8 de la referencia (1 = permanente, 0 = no, 255 = nodata)."""
    try:
        import rasterio  # noqa: PLC0415
    except ImportError:
        return False
    meta = dict(output.raster_meta)
    if not meta:
        return False
    meta.update(count=1, dtype="uint8", compress="lzw", nodata=255)
    ref = np.asarray(permanent, dtype=bool).astype(np.uint8)
    with rasterio.open(path, "w", **meta) as dst:
        dst.write(ref, 1)
    return True
