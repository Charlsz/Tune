"""Router ``/api``: análisis de imágenes satelitales con Prithvi (núcleo de la app)."""

from __future__ import annotations

import logging
import tempfile
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi import Path as PathParam
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse

from tune.application.analyze import AnalyzeUseCase
from tune.application.change import change_layers, compare
from tune.application.sectors import sectors as compute_sectors
from tune.application.series import series as build_series
from tune.application.territory import covers
from tune.application.territory import timeline as territory_timeline
from tune.domain.analysis import HazardTask
from tune.domain.ports import AnalysisRepository
from tune.infrastructure.catalog.stac import CatalogError, bbox_from_point
from tune.infrastructure.config import get_settings
from tune.infrastructure.examples import CATALOG, ExampleDownloadError, by_id, fetch
from tune.infrastructure.inference.prithvi import MODEL_CARDS
from tune.infrastructure.raster.grid import grid_from_meta, reproject_mask
from tune.interfaces.api.schemas import (
    AnalysisResponse,
    BoundsSchema,
    CatalogSceneSchema,
    ChangeSchema,
    ExampleInfo,
    SectorSchema,
    SeriesPointSchema,
    TaskInfo,
)

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


def get_catalog():
    return _container().catalog


@router.get("/tasks", response_model=list[TaskInfo], summary="Tareas y sus modelos")
def tasks() -> list[TaskInfo]:
    """Inundación y cicatriz de incendio, con el repositorio Hugging Face de cada checkpoint."""
    return [
        TaskInfo(
            id=task.value,
            label=_LABELS[task],
            model_id=card.repo_id,
            classes=list(card.class_names),
        )
        for task, card in MODEL_CARDS.items()
    ]


@router.get("/examples", response_model=list[ExampleInfo], summary="Escenas oficiales")
def examples() -> list[ExampleInfo]:
    """Catálogo cerrado de GeoTIFF de ejemplo. No se acepta una URL libre."""
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


@router.post(
    "/examples/{example_id}/analyze",
    response_model=AnalysisResponse,
    status_code=201,
    summary="Analizar una escena oficial",
    responses={
        404: {"description": "Id de escena desconocido"},
        503: {"description": "No se pudo bajar la escena o cargar el modelo"},
    },
)
async def analyze_example(
    example_id: str = PathParam(description="india, spain, usa, t10seh, t10sff o t10sgf"),
    use_case: AnalyzeUseCase = Depends(get_use_case),
) -> AnalysisResponse:
    """Baja el GeoTIFF de Hugging Face si no está en caché y corre la tarea fija de esa escena."""
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


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    status_code=201,
    summary="Analizar un GeoTIFF",
    responses={
        400: {"description": "El archivo no termina en .tif o .tiff"},
        413: {"description": "Supera 200 MB o no cabe en memoria"},
        422: {"description": "GeoTIFF inválido o número de bandas incorrecto"},
        503: {"description": "El checkpoint no cargó"},
    },
)
async def analyze(
    file: UploadFile = File(description="GeoTIFF .tif o .tiff, hasta 200 MB"),
    task: HazardTask = Form(description="flood o burn_scar"),
    use_case: AnalyzeUseCase = Depends(get_use_case),
) -> AnalysisResponse:
    """Corre el checkpoint Prithvi de la tarea y guarda máscara, preview y estadísticas.

    No entrena. La primera vez de cada tarea descarga unos 1,2 GB de pesos.
    """
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


@router.get(
    "/timeline",
    response_model=list[AnalysisResponse],
    summary="Línea de tiempo del territorio",
    responses={
        404: {"description": "analysis_id no existe"},
        422: {"description": "Falta analysis_id, o lat y lon juntos"},
    },
)
def timeline(
    analysis_id: str | None = Query(
        None, description="Territorio de este análisis. Alternativa a lat y lon"
    ),
    lat: float | None = Query(None, ge=-90, le=90, description="Latitud. Va junto con lon"),
    lon: float | None = Query(None, ge=-180, le=180, description="Longitud. Va junto con lat"),
    task: HazardTask | None = Query(None, description="Si se indica, solo esa tarea"),
    repo: AnalysisRepository = Depends(get_repository),
) -> list[AnalysisResponse]:
    """Análisis cuya caja cubre el mismo lugar, del más antiguo al más reciente.

    Con analysis_id, mismo territorio si la intersección cubre la mitad de la caja más chica.
    Con lat y lon, la caja tiene que contener el punto. Sin fecha de toma se usa la del análisis.
    """
    point = None
    bounds = None
    if analysis_id:
        try:
            anchor = repo.get(analysis_id)
        except KeyError as exc:
            raise HTTPException(404, str(exc)) from exc
        bounds = anchor.bounds
        if bounds is None:
            only = [anchor] if task in (None, anchor.task) else []
            return [AnalysisResponse.from_domain(a) for a in only]
    elif lat is not None and lon is not None:
        point = (lat, lon)
    else:
        raise HTTPException(422, "Indica analysis_id, o lat y lon")
    # ponytail: O(n) sobre analysis.json en disco. PostGIS si el historial crece.
    found = territory_timeline(repo.list(limit=10_000), bounds=bounds, point=point, task=task)
    return [AnalysisResponse.from_domain(a) for a in found]


@router.get(
    "/timeline/series",
    response_model=list[SeriesPointSchema],
    summary="Serie de km² del territorio",
    responses={422: {"description": "Falta analysis_id, o lat y lon"}},
)
def timeline_series(
    analysis_id: str | None = Query(None, description="Territorio de este análisis"),
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    task: HazardTask | None = Query(None),
    repo: AnalysisRepository = Depends(get_repository),
) -> list[SeriesPointSchema]:
    """Serie de km2 por fecha del territorio, del mas antiguo al mas reciente."""
    analyses = _territory_analyses(repo, analysis_id=analysis_id, lat=lat, lon=lon, task=task)
    return [
        SeriesPointSchema(
            date=p.date,
            analysis_id=p.analysis_id,
            affected_km2=p.affected_km2,
            new_km2=p.new_km2,
            persistent_km2=p.persistent_km2,
            receded_km2=p.receded_km2,
        )
        for p in build_series(analyses)
    ]


def _territory_analyses(repo, *, analysis_id, lat, lon, task):
    point = None
    bounds = None
    if analysis_id:
        try:
            anchor = repo.get(analysis_id)
        except KeyError as exc:
            raise HTTPException(404, str(exc)) from exc
        bounds = anchor.bounds
        if bounds is None:
            return [anchor] if task in (None, anchor.task) else []
    elif lat is not None and lon is not None:
        point = (lat, lon)
    else:
        raise HTTPException(422, "Indica analysis_id, o lat y lon")
    return territory_timeline(repo.list(limit=10_000), bounds=bounds, point=point, task=task)


@router.get(
    "/analyses/{analysis_a}/diff/{analysis_b}",
    summary="Diferencia entre dos análisis",
    responses={
        404: {"description": "Algún id no existe"},
        422: {"description": "Tareas distintas o sin mask.tif"},
    },
)
def analysis_diff(
    analysis_a: str = PathParam(description="Análisis actual (grilla destino)"),
    analysis_b: str = PathParam(description="Referencia"),
    format: str = Query("json", description="json o png"),
    repo: AnalysisRepository = Depends(get_repository),
):
    """Compara la máscara de B reproyectada a la grilla de A (B = referencia)."""
    try:
        a = repo.get(analysis_a)
        b = repo.get(analysis_b)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    if a.task is not b.task:
        raise HTTPException(422, "Los dos análisis deben ser de la misma tarea")
    try:
        mask_a = repo.artifact_path(analysis_a, "mask_tif")
        mask_b = repo.artifact_path(analysis_b, "mask_tif")
    except KeyError as exc:
        raise HTTPException(422, f"Falta mask.tif: {exc}") from exc

    import rasterio

    with rasterio.open(mask_a) as src:
        meta = dict(src.meta)
        current = src.read(1)
        valid_a = current != 255
    grid = grid_from_meta(meta)
    if grid is None:
        raise HTTPException(422, "El análisis A no tiene georreferencia")
    ref_mask, ref_valid = reproject_mask(mask_b, grid)
    positive = 1
    summary = compare(
        current,
        valid_a,
        positive,
        ref_mask == positive,
        ref_valid,
        a.affected_area_km2 / a.affected_pixels * 1e6 if a.affected_pixels else None,
        source="previous_analysis",
        reference_id=b.id,
        reference_dates=((b.acquired_at or b.created_at)[:10],),
    )
    if format == "png":
        import tempfile

        from tune.infrastructure.analyses.filesystem import write_change_png

        new, pers, rec = change_layers(current, valid_a, positive, ref_mask == positive, ref_valid)
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            write_change_png(new, pers, rec, Path(tmp.name))
            return FileResponse(tmp.name, media_type="image/png", filename="diff.png")
    return ChangeSchema(
        reference_source=summary.reference_source,
        reference_id=summary.reference_id,
        reference_dates=list(summary.reference_dates),
        new_pixels=summary.new_pixels,
        persistent_pixels=summary.persistent_pixels,
        receded_pixels=summary.receded_pixels,
        compared_pixels=summary.compared_pixels,
        new_area_km2=summary.new_area_km2,
        persistent_area_km2=summary.persistent_area_km2,
        receded_area_km2=summary.receded_area_km2,
    )


@router.get(
    "/analyses/{analysis_id}/sectors",
    response_model=list[SectorSchema],
    summary="Sectores críticos del análisis",
    responses={
        404: {"description": "No existe"},
        422: {"description": "Sin máscara georreferenciada"},
    },
)
def analysis_sectors(
    analysis_id: str = PathParam(description="Id de 12 caracteres"),
    cell_m: int = Query(1000, ge=100, le=10_000, description="Tamaño de celda en metros"),
    top: int = Query(10, ge=1, le=100),
    repo: AnalysisRepository = Depends(get_repository),
) -> list[SectorSchema]:
    """Celdas con más agua nueva (o afectada si no hay change)."""
    try:
        analysis = repo.get(analysis_id)
        mask_path = repo.artifact_path(analysis_id, "mask_tif")
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    import rasterio

    with rasterio.open(mask_path) as src:
        meta = dict(src.meta)
        mask = src.read(1)
        valid = mask != 255
    grid = grid_from_meta(meta)
    if grid is None:
        raise HTTPException(422, "Sin georreferencia")
    basis = "affected"
    if analysis.change is not None:
        try:
            ref_path = repo.artifact_path(analysis_id, "reference_tif")
            with rasterio.open(ref_path) as src:
                permanent = src.read(1) == 1
            mask_new = (mask == 1) & valid & ~permanent
            basis = "new"
        except KeyError:
            mask_new = (mask == 1) & valid
    else:
        mask_new = (mask == 1) & valid
    pixel_area = None
    if analysis.affected_area_km2 is not None and analysis.affected_pixels:
        pixel_area = analysis.affected_area_km2 / analysis.affected_pixels * 1e6
    found = compute_sectors(mask_new, valid, grid, cell_m=cell_m, pixel_area_m2=pixel_area, top=top)
    return [
        SectorSchema(
            row=s.row,
            col=s.col,
            bounds=BoundsSchema(**s.bounds.__dict__),
            new_pixels=s.new_pixels,
            new_km2=s.new_km2,
            fraction=s.fraction,
            rank=s.rank,
            basis=basis,
        )
        for s in found
    ]


@router.get(
    "/analyses",
    response_model=list[AnalysisResponse],
    summary="Historial",
    responses={422: {"description": "lat y lon no van juntos, o están fuera de rango"}},
)
def list_analyses(
    limit: int = Query(50, description="Cuántos análisis devolver, más reciente primero"),
    lat: float | None = Query(
        None, ge=-90, le=90, description="Si viene, solo cajas que contienen este punto"
    ),
    lon: float | None = Query(None, ge=-180, le=180, description="Obligatoria si hay lat"),
    task: HazardTask | None = Query(None, description="Filtra flood o burn_scar"),
    repo: AnalysisRepository = Depends(get_repository),
) -> list[AnalysisResponse]:
    """Sin lat ni lon, los más recientes. Con las dos, los que cubren el punto."""
    if (lat is None) != (lon is None):
        raise HTTPException(422, "lat y lon van juntos")
    scanning = lat is not None or task is not None
    # ponytail: con filtro se leen todos los analysis.json. PostGIS si el historial crece.
    found = repo.list(limit=10_000 if scanning else limit)
    if task is not None:
        found = [a for a in found if a.task is task]
    if lat is not None and lon is not None:
        found = [a for a in found if a.bounds is not None and covers(a.bounds, lat, lon)]
    if scanning:
        found = found[:limit]
    return [AnalysisResponse.from_domain(a) for a in found]


@router.get(
    "/analyses/{analysis_id}",
    response_model=AnalysisResponse,
    summary="Un análisis",
    responses={404: {"description": "No hay analysis.json con ese id"}},
)
def get_analysis(
    analysis_id: str = PathParam(description="Id de 12 caracteres"),
    repo: AnalysisRepository = Depends(get_repository),
) -> AnalysisResponse:
    """JSON guardado. No vuelve a correr el modelo."""
    try:
        return AnalysisResponse.from_domain(repo.get(analysis_id))
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.delete(
    "/analyses/{analysis_id}",
    status_code=204,
    summary="Borrar un análisis",
    responses={404: {"description": "No hay analysis.json con ese id"}},
)
def delete_analysis(
    analysis_id: str = PathParam(description="Id de 12 caracteres"),
    repo: AnalysisRepository = Depends(get_repository),
) -> Response:
    """Borra la carpeta del análisis: JSON, GeoTIFF de entrada, máscara y preview."""
    try:
        repo.delete(analysis_id)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    return Response(status_code=204)


@router.get(
    "/analyses/{analysis_id}/{artifact}",
    summary="Descargar un archivo del análisis",
    responses={
        200: {"description": "PNG o GeoTIFF", "content": {"image/png": {}, "image/tiff": {}}},
        404: {"description": "El análisis o ese archivo no existen"},
    },
)
def get_artifact(
    analysis_id: str = PathParam(description="Id de 12 caracteres"),
    artifact: str = PathParam(
        description="mask_png, preview_png, mask_tif, input, change_png o reference_tif"
    ),
    repo: AnalysisRepository = Depends(get_repository),
) -> FileResponse:
    """mask_png y preview_png son PNG. mask_tif e input son GeoTIFF."""
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


@router.get(
    "/catalog/search",
    response_model=list[CatalogSceneSchema],
    summary="Buscar escenas Sentinel-2",
    responses={
        422: {"description": "Parámetros inválidos"},
        503: {"description": "STAC no respondió"},
    },
)
def catalog_search(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    start: str = Query(description="YYYY-MM-DD"),
    end: str = Query(description="YYYY-MM-DD"),
    max_cloud: float = Query(40.0, ge=0, le=100),
    side_km: float = Query(20.0, ge=1, le=50),
    catalog=Depends(get_catalog),
) -> list[CatalogSceneSchema]:
    """Lista escenas L2A de Earth Search alrededor del punto, sin descargar bandas."""
    try:
        items = catalog.search(lat, lon, start, end, max_cloud=max_cloud, side_km=side_km)
    except CatalogError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(503, f"STAC no respondió: {exc}") from exc
    return [
        CatalogSceneSchema(
            id=i.id,
            datetime=i.datetime,
            cloud_cover=i.cloud_cover,
            bbox=list(i.bbox),
            thumbnail=i.thumbnail,
        )
        for i in items
    ]


@router.post(
    "/catalog/{item_id}/analyze",
    response_model=AnalysisResponse,
    status_code=201,
    summary="Analizar una escena del catálogo",
    responses={
        422: {"description": "Escena inválida o demasiado nublada"},
        503: {"description": "No se pudo descargar o cargar el modelo"},
    },
)
async def catalog_analyze(
    item_id: str = PathParam(description="Id STAC de la escena"),
    task: HazardTask = Form(description="flood o burn_scar"),
    lat: float = Form(ge=-90, le=90),
    lon: float = Form(ge=-180, le=180),
    side_km: float = Form(20.0, ge=1, le=50),
    use_case: AnalyzeUseCase = Depends(get_use_case),
    catalog=Depends(get_catalog),
) -> AnalysisResponse:
    """Descarga el recorte de 6 bandas y corre el análisis."""
    bbox = bbox_from_point(lat, lon, side_km)
    dest = get_settings().tune_artifacts_dir / "catalog"
    try:
        path = await run_in_threadpool(catalog.fetch_six_bands, item_id, bbox, dest)
        analysis = await run_in_threadpool(use_case.execute, path, task, filename=path.name)
    except CatalogError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise _http_for(exc) from exc
    return AnalysisResponse.from_domain(analysis)
