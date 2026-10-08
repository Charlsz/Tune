"""Exposición de la máscara nueva sobre cobertura y población.

Puro sobre arrays ya alineados a la grilla del análisis.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from tune.domain.analysis import ExposureClass, ExposureSummary

# ESA WorldCover 2021 (códigos oficiales).
WORLDCOVER_LABELS: dict[int, str] = {
    10: "Bosque",
    20: "Matorral",
    30: "Pastizal",
    40: "Cultivo",
    50: "Urbano",
    60: "Suelo desnudo",
    70: "Nieve / hielo",
    80: "Agua permanente",
    90: "Humedal",
    95: "Manglar",
    100: "Musgo / liquen",
}


def expose(
    new_mask: Any,
    valid: Any,
    landcover: Any,
    landcover_valid: Any,
    population: Any | None,
    population_valid: Any | None,
    pixel_area_m2: float | None,
    *,
    landcover_source: str = "esa_worldcover_2021",
    population_source: str = "ghsl_pop_2020",
) -> ExposureSummary:
    """Agrega km² nuevos por clase de cobertura y suma población sobre esos píxeles."""
    new = np.asarray(new_mask, dtype=bool)
    val = np.asarray(valid, dtype=bool)
    lc = np.asarray(landcover)
    lcv = np.asarray(landcover_valid, dtype=bool)
    if new.shape != val.shape or new.shape != lc.shape or new.shape != lcv.shape:
        raise ValueError("formas incompatibles entre máscara y cobertura")

    counted = new & val & lcv
    n_counted = int(counted.sum())
    area_total = (n_counted * pixel_area_m2 / 1e6) if pixel_area_m2 is not None else None

    classes: list[ExposureClass] = []
    if n_counted:
        codes, counts = np.unique(lc[counted], return_counts=True)
        for code, n in zip(codes.tolist(), counts.tolist(), strict=True):
            code_i = int(code)
            n_i = int(n)
            classes.append(
                ExposureClass(
                    code=code_i,
                    label=WORLDCOVER_LABELS.get(code_i, f"clase {code_i}"),
                    pixels=n_i,
                    area_km2=(n_i * pixel_area_m2 / 1e6) if pixel_area_m2 is not None else None,
                    fraction=n_i / n_counted,
                )
            )
        classes.sort(key=lambda c: c.pixels, reverse=True)

    people = None
    pop_source = population_source
    if population is not None and population_valid is not None:
        pop = np.asarray(population, dtype=np.float64)
        pv = np.asarray(population_valid, dtype=bool)
        if pop.shape != new.shape:
            raise ValueError("formas incompatibles entre máscara y población")
        people = float(np.clip(pop[new & val & pv], 0, None).sum())
    else:
        pop_source = "none"

    return ExposureSummary(
        landcover_source=landcover_source,
        population_source=pop_source,
        new_area_km2=area_total,
        population_exposed=people,
        classes=tuple(classes),
    )
