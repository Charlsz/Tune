"""Agrupa análisis que cubren el mismo pedazo de terreno.

Puro sobre ``GeoBounds`` (EPSG:4326). No conoce disco ni HTTP: el router le pasa
la lista y decide qué devolver.
"""

from __future__ import annotations

from tune.domain.analysis import Analysis, GeoBounds, HazardTask


def covers(bounds: GeoBounds, lat: float, lon: float) -> bool:
    """El punto cae dentro de la caja, bordes incluidos."""
    return bounds.west <= lon <= bounds.east and bounds.south <= lat <= bounds.north


def _area(b: GeoBounds) -> float:
    return max(0.0, b.east - b.west) * max(0.0, b.north - b.south)


def _intersection(a: GeoBounds, b: GeoBounds) -> float:
    width = min(a.east, b.east) - max(a.west, b.west)
    height = min(a.north, b.north) - max(a.south, b.south)
    if width <= 0 or height <= 0:
        return 0.0
    return width * height


def same_territory(a: GeoBounds, b: GeoBounds) -> bool:
    """La intersección cubre al menos la mitad de la caja más chica."""
    shared = _intersection(a, b)
    if shared == 0:
        return False
    smaller = min(_area(a), _area(b))
    if smaller == 0:
        return True
    return shared / smaller >= 0.5


def when(analysis: Analysis) -> str:
    """Fecha para ordenar: la de la toma, o la del análisis si el TIFF no la trae."""
    return analysis.acquired_at or analysis.created_at


def timeline(
    analyses: list[Analysis],
    *,
    bounds: GeoBounds | None = None,
    point: tuple[float, float] | None = None,
    task: HazardTask | None = None,
) -> list[Analysis]:
    """Análisis del mismo territorio, del más antiguo al más reciente.

    Sin ``bounds`` ni ``point`` no hay territorio: devuelve lista vacía.
    Un análisis sin caja geográfica no se puede ubicar y se omite.
    """
    if bounds is None and point is None:
        return []
    out = []
    for analysis in analyses:
        if task is not None and analysis.task is not task:
            continue
        if analysis.bounds is None:
            continue
        if bounds is not None and not same_territory(analysis.bounds, bounds):
            continue
        if point is not None and not covers(analysis.bounds, point[0], point[1]):
            continue
        out.append(analysis)
    out.sort(key=when)
    return out
