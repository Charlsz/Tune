"""Acuerdo entre la máscara de Tune y capas de observación externas.

Puro sobre arrays. IoU y conteos solo donde ambas capas tienen dato.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from tune.domain.analysis import FusionSummary, ObservationLayer


def fuse(
    mask: Any,
    valid: Any,
    positive_class: int,
    layers: list[ObservationLayer],
    pixel_area_m2: float | None,
) -> FusionSummary | None:
    """Compara Tune contra la unión de capas externas válidas.

    Un píxel externo es agua si alguna capa lo marca True y al menos una
    capa lo considera válido. ``unknown`` son píxeles válidos en Tune pero
    sin dato en ninguna capa externa.
    """
    if not layers:
        return None
    m = np.asarray(mask)
    v = np.asarray(valid, dtype=bool)
    tune = (m == positive_class) & v

    ext = np.zeros(m.shape, dtype=bool)
    ext_valid = np.zeros(m.shape, dtype=bool)
    sources: list[str] = ["prithvi"]
    for layer in layers:
        lv = np.asarray(layer.valid, dtype=bool)
        lm = np.asarray(layer.mask, dtype=bool)
        if lv.shape != m.shape or lm.shape != m.shape:
            raise ValueError(f"capa {layer.source} {lm.shape} no coincide con Tune {m.shape}")
        ext_valid |= lv
        ext |= lm & lv
        sources.append(layer.source)

    both = v & ext_valid
    agree = tune & ext & both
    tune_only = tune & ~ext & both
    external_only = ext & ~tune & both
    unknown = v & ~ext_valid
    n_both = int(both.sum())
    n_agree = int(agree.sum())
    n_tune = int(tune_only.sum())
    n_ext = int(external_only.sum())
    union = n_agree + n_tune + n_ext
    iou = (n_agree / union) if union else None

    def area(n: int) -> float | None:
        if pixel_area_m2 is None:
            return None
        return n * pixel_area_m2 / 1e6

    return FusionSummary(
        sources=tuple(sources),
        compared_pixels=n_both,
        agree_pixels=n_agree,
        tune_only_pixels=n_tune,
        external_only_pixels=n_ext,
        unknown_pixels=int(unknown.sum()),
        iou=iou,
        agree_area_km2=area(n_agree),
        tune_only_area_km2=area(n_tune),
        external_only_area_km2=area(n_ext),
    )


def fusion_layers(
    mask: Any,
    valid: Any,
    positive_class: int,
    layers: list[ObservationLayer],
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Cuatro máscaras bool: acuerdo, solo Tune, solo externo, desconocido."""
    m = np.asarray(mask)
    v = np.asarray(valid, dtype=bool)
    tune = (m == positive_class) & v
    ext = np.zeros(m.shape, dtype=bool)
    ext_valid = np.zeros(m.shape, dtype=bool)
    for layer in layers:
        lv = np.asarray(layer.valid, dtype=bool)
        lm = np.asarray(layer.mask, dtype=bool)
        ext_valid |= lv
        ext |= lm & lv
    both = v & ext_valid
    return (
        tune & ext & both,
        tune & ~ext & both,
        ext & ~tune & both,
        v & ~ext_valid,
    )
