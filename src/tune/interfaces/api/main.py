"""API de inferencia: ``GET /health``, ``GET /model``, ``POST /predict``.

Arranque local:   uvicorn tune.interfaces.api.main:app --reload
En Docker:        docker compose up   # app; laboratorio: ver lab/
"""

from __future__ import annotations

import time
from functools import lru_cache

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from tune import __version__
from tune.infrastructure.config import get_settings
from tune.interfaces.api.analyses import router as analyses_router
from tune.interfaces.api.schemas import HealthResponse, ModelInfoResponse, PredictResponse

app = FastAPI(
    title="Tune API",
    version=__version__,
    description=(
        "Análisis de imágenes satelitales con Prithvi-EO 2.0. "
        "Las rutas de la aplicación están bajo /api. "
        "/health, /model y /predict son del laboratorio, no analizan un GeoTIFF."
    ),
    openapi_tags=[
        {
            "name": "analysis",
            "description": "App: GeoTIFF a máscara de inundación o cicatriz de incendio.",
        },
        {"name": "ops", "description": "Estado del proceso."},
        {
            "name": "model",
            "description": "Laboratorio de fine-tuning. No es el análisis de la demo.",
        },
    ],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(analyses_router)


@lru_cache
def _predictor():
    """Carga perezosa: la API arranca aunque no haya modelo aprobado todavía."""
    from tune.infrastructure.container import Container  # noqa: PLC0415
    from tune.infrastructure.inference import RegistryPredictor  # noqa: PLC0415

    c = Container()
    return RegistryPredictor(c.registry, c.settings.tune_model_name, c.settings.tune_model_alias)


@app.get("/health", response_model=HealthResponse, tags=["ops"], summary="Estado del proceso")
def health() -> HealthResponse:
    """Responde en cuanto el proceso está vivo. No comprueba Hugging Face ni la GPU."""
    return HealthResponse(version=__version__)


@app.get(
    "/model", response_model=ModelInfoResponse, tags=["model"], summary="Modelo del laboratorio"
)
def model_info() -> ModelInfoResponse:
    """Alias del Model Registry. La app usa los checkpoints de /api/tasks."""
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


@app.post(
    "/predict",
    response_model=PredictResponse,
    tags=["model"],
    summary="Predecir con el modelo del laboratorio",
    responses={
        400: {"description": "No vino un archivo"},
        501: {"description": "El predictor del laboratorio no está implementado"},
        503: {"description": "No hay modelo aprobado en el registry"},
    },
)
async def predict(
    file: UploadFile = File(description="Archivo que espera el predictor del laboratorio"),
) -> PredictResponse:
    """Ruta del laboratorio de fine-tuning. Para inundación o incendio usa POST /api/analyze."""
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
