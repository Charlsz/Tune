"""Contratos de la API (plan.md, Fase 5.3: la versión del modelo viaja en la respuesta)."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from pydantic import BaseModel, Field

from tune.domain.analysis import Analysis


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str


class ModelInfoResponse(BaseModel):
    name: str
    alias: str
    version: str | None = Field(None, description="None si aún no hay modelo aprobado")
    loaded: bool


class PredictResponse(BaseModel):
    result: Any
    model_version: str
    latency_ms: float


class TaskInfo(BaseModel):
    id: str
    label: str
    model_id: str
    classes: list[str]


class BoundsSchema(BaseModel):
    west: float
    south: float
    east: float
    north: float


class AnalysisResponse(BaseModel):
    id: str
    task: str
    created_at: str
    model_id: str
    input_filename: str
    width: int
    height: int
    valid_pixels: int
    affected_pixels: int
    affected_ratio: float
    affected_area_km2: float | None
    crs: str | None
    bounds: BoundsSchema | None
    latency_s: float
    artifacts: dict[str, str] = Field(description="nombre -> URL relativa bajo /api/analyses/{id}/")

    @classmethod
    def from_domain(cls, a: Analysis) -> AnalysisResponse:
        return cls(
            id=a.id,
            task=a.task.value,
            created_at=a.created_at,
            model_id=a.model_id,
            input_filename=a.input_filename,
            width=a.width,
            height=a.height,
            valid_pixels=a.valid_pixels,
            affected_pixels=a.affected_pixels,
            affected_ratio=a.affected_ratio,
            affected_area_km2=a.affected_area_km2,
            crs=a.crs,
            bounds=BoundsSchema(**asdict(a.bounds)) if a.bounds else None,
            latency_s=a.latency_s,
            artifacts={k: f"/api/analyses/{a.id}/{k}" for k in a.artifacts},
        )
