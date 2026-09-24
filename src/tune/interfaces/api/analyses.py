"""Router ``/api``: análisis de imágenes satelitales con Prithvi (núcleo de la app)."""

from __future__ import annotations

import logging
import tempfile
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse

from tune.application.analyze import AnalyzeUseCase
from tune.domain.analysis import HazardTask
from tune.domain.ports import AnalysisRepository
from tune.infrastructure.config import get_settings
from tune.infrastructure.examples import CATALOG, ExampleDownloadError, by_id, fetch
from tune.infrastructure.inference.prithvi import MODEL_CARDS
from tune.interfaces.api.schemas import AnalysisResponse, ExampleInfo, TaskInfo

router = APIRouter(prefix="/api", tags=["analysis"])

log = logging.getLogger(__name__)

_MAX_UPLOAD_MB = 200
_MAX_UPLOAD_BYTES = _MAX_UPLOAD_MB * 1024 * 1024
_CHUNK = 1024 * 1024


@lru_cache
def _container():
    # Un solo Container por proceso: el segmentador guarda los modelos (~1.2 GB)
    # y recargarlos en cada request costaría minutos.
    from tune.infrastructure.container import Container  # noqa: PLC0415

    return Container()


def get_use_case() -> AnalyzeUseCase:
    return _container().analyze


def get_repository() -> AnalysisRepository:
    return _container().analyses


@router.get("/tasks", response_model=list[TaskInfo])
def tasks() -> list[TaskInfo]:
    return [
        TaskInfo(
            id=task.value,
            label=_LABELS[task],
            model_id=card.repo_id,
            classes=list(card.class_names),
        )
        for task, card in MODEL_CARDS.items()
    ]


@router.get("/examples", response_model=list[ExampleInfo])
def examples() -> list[ExampleInfo]:
    return [
        ExampleInfo(
            id=s.id,
            task=s.task,
            label=s.label,
            filename=s.filename,
            size_bytes=s.size_bytes,
        )
        for s in CATALOG
    ]


@router.post("/examples/{example_id}/analyze", response_model=AnalysisResponse, status_code=201)
async def analyze_example(
    example_id: str,
    use_case: AnalyzeUseCase = Depends(get_use_case),
) -> AnalysisResponse:
    try:
        scene = by_id(example_id)
    except KeyError as exc:
        raise HTTPException(404, f"Escena de ejemplo desconocida: {example_id}") from exc
    dest_dir = get_settings().tune_artifacts_dir / "examples"
    try:
        path = await run_in_threadpool(fetch, scene, dest_dir)
        analysis = await run_in_threadpool(
            use_case.execute, path, HazardTask(scene.task), filename=scene.filename
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_for(exc) from exc
    return AnalysisResponse.from_domain(analysis)


@router.post("/analyze", response_model=AnalysisResponse, status_code=201)
async def analyze(
    file: UploadFile = File(...),
    task: HazardTask = Form(...),
    use_case: AnalyzeUseCase = Depends(get_use_case),
) -> AnalysisResponse:
    if not file.filename or not file.filename.lower().endswith((".tif", ".tiff")):
        raise HTTPException(400, "Se espera un GeoTIFF (.tif/.tiff)")

    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / Path(file.filename).name
        written = 0
        with dest.open("wb") as fh:
            while chunk := await file.read(_CHUNK):
                written += len(chunk)
                if written > _MAX_UPLOAD_BYTES:
                    raise HTTPException(413, f"Archivo mayor a {_MAX_UPLOAD_MB} MB")
                fh.write(chunk)
        try:
            analysis = await run_in_threadpool(use_case.execute, dest, task, filename=file.filename)
        except Exception as exc:
            raise _http_for(exc) from exc
    return AnalysisResponse.from_domain(analysis)


def _http_for(exc: Exception) -> HTTPException:
    if isinstance(exc, ImportError):
        return HTTPException(503, str(exc))
    if isinstance(exc, ExampleDownloadError):
        return HTTPException(503, str(exc))
    if isinstance(exc, OSError):
        return HTTPException(422, f"GeoTIFF no válido: {exc}")
    if isinstance(exc, ValueError):
        return HTTPException(422, str(exc))
    if isinstance(exc, MemoryError):
        return HTTPException(413, "Imagen demasiado grande para la memoria disponible")
    log.exception("Fallo de inferencia")
    return HTTPException(503, f"Fallo del modelo: {exc}")


@router.get("/analyses", response_model=list[AnalysisResponse])
def list_analyses(
    limit: int = 50, repo: AnalysisRepository = Depends(get_repository)
) -> list[AnalysisResponse]:
    return [AnalysisResponse.from_domain(a) for a in repo.list(limit=limit)]


@router.get("/analyses/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(
    analysis_id: str, repo: AnalysisRepository = Depends(get_repository)
) -> AnalysisResponse:
    try:
        return AnalysisResponse.from_domain(repo.get(analysis_id))
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/analyses/{analysis_id}/{artifact}")
def get_artifact(
    analysis_id: str, artifact: str, repo: AnalysisRepository = Depends(get_repository)
) -> FileResponse:
    try:
        path = repo.artifact_path(analysis_id, artifact)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    media = "image/png" if path.suffix == ".png" else "image/tiff"
    return FileResponse(path, media_type=media, filename=path.name)


_LABELS = {
    HazardTask.FLOOD: "Inundación (Sentinel-2, Sen1Floods11)",
    HazardTask.BURN_SCAR: "Cicatriz de incendio (HLS, Burn Scars)",
}
