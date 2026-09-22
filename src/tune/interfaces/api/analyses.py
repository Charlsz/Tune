"""Router ``/api``: análisis de imágenes satelitales con Prithvi (núcleo de la app)."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from tune.application.analyze import AnalyzeUseCase
from tune.domain.analysis import HazardTask
from tune.domain.ports import AnalysisRepository
from tune.infrastructure.inference.prithvi import MODEL_CARDS
from tune.interfaces.api.schemas import AnalysisResponse, TaskInfo

router = APIRouter(prefix="/api", tags=["analysis"])

_MAX_UPLOAD_MB = 200


def get_use_case() -> AnalyzeUseCase:
    from tune.infrastructure.container import Container  # noqa: PLC0415

    return Container().analyze


def get_repository() -> AnalysisRepository:
    from tune.infrastructure.container import Container  # noqa: PLC0415

    return Container().analyses


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
        with dest.open("wb") as fh:
            shutil.copyfileobj(file.file, fh, length=1024 * 1024)
        if dest.stat().st_size > _MAX_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(413, f"Archivo mayor a {_MAX_UPLOAD_MB} MB")
        try:
            analysis = use_case.execute(dest, task, filename=file.filename)
        except ImportError as exc:
            raise HTTPException(503, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
    return AnalysisResponse.from_domain(analysis)


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
