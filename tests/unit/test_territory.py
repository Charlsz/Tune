"""Agrupación de análisis por territorio, sin disco ni HTTP."""

from __future__ import annotations

from tune.application.territory import covers, same_territory, timeline, when
from tune.domain.analysis import Analysis, GeoBounds, HazardTask

BOX = GeoBounds(west=-75.0, south=4.0, east=-74.0, north=5.0)


def analysis(
    id: str,
    *,
    bounds: GeoBounds | None = BOX,
    task: HazardTask = HazardTask.FLOOD,
    acquired_at: str | None = None,
    created_at: str = "2026-01-01T00:00:00+00:00",
) -> Analysis:
    return Analysis(
        id=id,
        task=task,
        created_at=created_at,
        model_id="fake/prithvi",
        input_filename=f"{id}.tif",
        width=4,
        height=4,
        valid_pixels=16,
        affected_pixels=4,
        affected_ratio=0.25,
        affected_area_km2=1.0,
        crs="EPSG:4326",
        bounds=bounds,
        latency_s=0.1,
        acquired_at=acquired_at,
    )


def test_covers_includes_edges_and_rejects_outside() -> None:
    assert covers(BOX, 4.0, -75.0)
    assert covers(BOX, 4.5, -74.5)
    assert not covers(BOX, 4.5, -75.1)
    assert not covers(BOX, 5.1, -74.5)


def test_same_territory_needs_half_of_the_smaller_box() -> None:
    # Cajas del mismo tamaño: la intersección es el 50 % y el 40 % de cada una.
    half = GeoBounds(west=-74.5, south=4.0, east=-73.5, north=5.0)
    less = GeoBounds(west=-74.4, south=4.0, east=-73.4, north=5.0)
    far = GeoBounds(west=0.0, south=0.0, east=1.0, north=1.0)
    assert same_territory(BOX, BOX)
    assert same_territory(BOX, half)
    assert not same_territory(BOX, less)
    assert not same_territory(BOX, far)


def test_same_territory_is_symmetric_for_a_small_box_inside() -> None:
    chip = GeoBounds(west=-74.2, south=4.2, east=-74.1, north=4.3)
    assert same_territory(BOX, chip)
    assert same_territory(chip, BOX)


def test_timeline_orders_by_acquisition_and_falls_back_to_created_at() -> None:
    items = [
        analysis("late", acquired_at="2020-06-01", created_at="2026-03-01T00:00:00+00:00"),
        analysis("none", created_at="2019-01-01T00:00:00+00:00"),
        analysis("early", acquired_at="2018-07-09", created_at="2026-09-01T00:00:00+00:00"),
    ]
    assert [a.id for a in timeline(items, bounds=BOX)] == ["early", "none", "late"]
    assert when(items[1]) == "2019-01-01T00:00:00+00:00"


def test_timeline_filters_by_task_point_and_drops_unlocated() -> None:
    items = [
        analysis("flood", task=HazardTask.FLOOD),
        analysis("burn", task=HazardTask.BURN_SCAR, acquired_at="2018-01-01"),
        analysis("nowhere", bounds=None),
        analysis("other", bounds=GeoBounds(west=10, south=10, east=11, north=11)),
    ]
    assert [a.id for a in timeline(items, bounds=BOX, task=HazardTask.FLOOD)] == ["flood"]
    assert [a.id for a in timeline(items, point=(4.5, -74.5))] == ["burn", "flood"]
    assert timeline(items, point=(0.0, 0.0)) == []
    assert timeline(items) == []
