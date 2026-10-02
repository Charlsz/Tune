"""Comparación de la máscara actual contra una referencia (agua permanente / cicatriz previa).

Puro sobre arrays: F_t = W_t AND NOT P. No conoce disco ni HTTP.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from tune.domain.analysis import ChangeSummary


def compare(
    mask: Any,
    valid: Any,
    positive_class: int,
    reference: Any,
    reference_valid: Any,
    pixel_area_m2: float | None,
    *,
    source: str,
    reference_id: str | None = None,
    reference_dates: tuple[str, ...] = (),
) -> ChangeSummary:
    """Cuenta agua nueva, persistente y retirada donde ambas capas tienen dato.

    ``reference`` es bool (True = permanente). Solo cuenta píxeles donde
    ``valid AND reference_valid``. Lanza ``ValueError`` si las formas no coinciden.
    """
    m = np.asarray(mask)
    v = np.asarray(valid, dtype=bool)
    p = np.asarray(reference, dtype=bool)
    pv = np.asarray(reference_valid, dtype=bool)
    if m.shape != v.shape or m.shape != p.shape or m.shape != pv.shape:
        raise ValueError(
            f"formas incompatibles: mask {m.shape}, valid {v.shape}, "
            f"reference {p.shape}, reference_valid {pv.shape}"
        )
    both = v & pv
    water = (m == positive_class) & both
    permanent = p & both
    new = water & ~permanent
    persistent = water & permanent
    receded = permanent & ~water
    n_new = int(new.sum())
    n_pers = int(persistent.sum())
    n_rec = int(receded.sum())
    n_cmp = int(both.sum())

    def area(n: int) -> float | None:
        if pixel_area_m2 is None:
            return None
        return n * pixel_area_m2 / 1e6

    return ChangeSummary(
        reference_source=source,
        reference_id=reference_id,
        reference_dates=tuple(reference_dates),
        new_pixels=n_new,
        persistent_pixels=n_pers,
        receded_pixels=n_rec,
        compared_pixels=n_cmp,
        new_area_km2=area(n_new),
        persistent_area_km2=area(n_pers),
        receded_area_km2=area(n_rec),
    )


def change_layers(
    mask: Any,
    valid: Any,
    positive_class: int,
    reference: Any,
    reference_valid: Any,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Tres máscaras bool (nuevo, persistente, retirado) para pintar ``change.png``."""
    m = np.asarray(mask)
    v = np.asarray(valid, dtype=bool)
    p = np.asarray(reference, dtype=bool)
    pv = np.asarray(reference_valid, dtype=bool)
    both = v & pv
    water = (m == positive_class) & both
    permanent = p & both
    return water & ~permanent, water & permanent, permanent & ~water
