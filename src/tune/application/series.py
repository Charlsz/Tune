"""Serie temporal de análisis del mismo territorio."""

from __future__ import annotations

from dataclasses import dataclass

from tune.domain.analysis import Analysis


@dataclass(frozen=True)
class SeriesPoint:
    date: str
    analysis_id: str
    affected_km2: float | None
    new_km2: float | None
    persistent_km2: float | None
    receded_km2: float | None


def series(analyses: list[Analysis]) -> list[SeriesPoint]:
    """Ordena por fecha de toma (o de análisis) y resume km²."""
    ordered = sorted(analyses, key=lambda a: a.acquired_at or a.created_at)
    out = []
    for a in ordered:
        out.append(
            SeriesPoint(
                date=(a.acquired_at or a.created_at)[:10],
                analysis_id=a.id,
                affected_km2=a.affected_area_km2,
                new_km2=a.change.new_area_km2 if a.change else None,
                persistent_km2=a.change.persistent_area_km2 if a.change else None,
                receded_km2=a.change.receded_area_km2 if a.change else None,
            )
        )
    return out
