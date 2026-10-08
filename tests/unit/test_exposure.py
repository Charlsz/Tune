"""Exposición de agua nueva sobre cobertura y población, sin red."""

from __future__ import annotations

import numpy as np
import pytest

from tune.application.exposure import WORLDCOVER_LABELS, expose


def test_expose_groups_worldcover_classes() -> None:
    new = np.array([[1, 1, 0], [1, 0, 0]], dtype=bool)
    valid = np.ones((2, 3), dtype=bool)
    land = np.array([[40, 50, 10], [40, 80, 10]], dtype=np.uint8)
    lcv = np.ones((2, 3), dtype=bool)
    summary = expose(new, valid, land, lcv, None, None, 10_000)
    assert summary.landcover_source == "esa_worldcover_2021"
    assert summary.population_source == "none"
    assert summary.population_exposed is None
    assert summary.new_area_km2 == pytest.approx(0.03)
    labels = {c.label: c for c in summary.classes}
    assert labels["Cultivo"].pixels == 2
    assert labels["Urbano"].pixels == 1
    assert labels["Cultivo"].fraction == pytest.approx(2 / 3)
    assert WORLDCOVER_LABELS[40] == "Cultivo"


def test_expose_sums_population_on_new_pixels() -> None:
    new = np.array([[1, 0], [1, 0]], dtype=bool)
    valid = np.ones((2, 2), dtype=bool)
    land = np.full((2, 2), 50, dtype=np.uint8)
    pop = np.array([[10.0, 99.0], [5.5, 7.0]])
    pv = np.ones((2, 2), dtype=bool)
    summary = expose(new, valid, land, np.ones((2, 2), dtype=bool), pop, pv, None)
    assert summary.population_exposed == pytest.approx(15.5)
    assert summary.population_source == "ghsl_pop_2020"


def test_expose_ignores_invalid_landcover() -> None:
    new = np.ones((2, 2), dtype=bool)
    valid = np.ones((2, 2), dtype=bool)
    land = np.full((2, 2), 40, dtype=np.uint8)
    lcv = np.array([[1, 0], [0, 0]], dtype=bool)
    summary = expose(new, valid, land, lcv, None, None, 1.0)
    assert summary.classes[0].pixels == 1
    assert summary.new_area_km2 == pytest.approx(1e-6)


def test_expose_rejects_shape_mismatch() -> None:
    with pytest.raises(ValueError, match="incompatibles"):
        expose(
            np.ones((2, 2), dtype=bool),
            np.ones((2, 2), dtype=bool),
            np.ones((3, 3)),
            np.ones((3, 3), dtype=bool),
            None,
            None,
            None,
        )
