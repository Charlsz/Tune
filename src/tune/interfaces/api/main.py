"""API de inferencia: ``GET /health``, ``GET /model``, ``POST /predict``.

Arranque local:   uvicorn tune.interfaces.api.main:app --reload
En Docker:        docker compose up api
"""

from __future__ import annotations

import time
from functools import lru_cache

from fastapi import FastAPI, HTTPException, UploadFile

from tune import __version__
from tune.infrastructure.config import get_settings
from tune.interfaces.api.schemas import HealthResponse, ModelInfoResponse, PredictResponse

app = FastAPI(
    title="Tune inference API",
    version=__version__,
    description="Sirve el modelo aprobado del par experimental baseline vs optimized.",
)


@lru_cache
def _predictor():
    """Carga perezosa: la API arranca aunque no haya modelo aprobado todavía."""
    from tune.infrastructure.container import Container  # noqa: PLC0415
    from tune.infrastructure.inference import RegistryPredictor  # noqa: PLC0415

    c = Container()
    return RegistryPredictor(c.registry, c.settings.tune_model_name, c.settings.tune_model_alias)


@app.get("/health", response_model=HealthResponse, tags=["ops"])
def health() -> HealthResponse:
    return HealthResponse(version=__version__)


@app.get("/model", response_model=ModelInfoResponse, tags=["model"])
def model_info() -> ModelInfoResponse:
    s = get_settings()
    try:
        p = _predictor()
        return ModelInfoResponse(
            name=s.tune_model_name, alias=s.tune_model_alias, version=p.model_version, loaded=True
        )
    except Exception:  # registry sin modelo, MLflow caído, etc.
        return ModelInfoResponse(
            name=s.tune_model_name, alias=s.tune_model_alias, version=None, loaded=False
        )


@app.post("/predict", response_model=PredictResponse, tags=["model"])
async def predict(file: UploadFile) -> PredictResponse:
    """Input/output según la tarea del caso (ADR 001). Esqueleto hasta la Fase 5."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    try:
        p = _predictor()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Modelo no disponible: {exc}") from exc

    t0 = time.perf_counter()
    try:
        result = p.predict(await file.read())
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    return PredictResponse(
        result=result,
        model_version=p.model_version,
        latency_ms=(time.perf_counter() - t0) * 1000,
    )
