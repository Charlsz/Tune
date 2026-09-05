"""Contratos de la API (plan.md, Fase 5.3: la versión del modelo viaja en la respuesta)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


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
