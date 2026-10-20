"""Router ``/api``: análisis de imágenes satelitales con Prithvi (núcleo de la app)."""

from __future__ import annotations

import asyncio
import json
import logging
import tempfile
import threading
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi import Path as PathParam
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, StreamingResponse

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
from tune.infrastructure.examples import (
    CATALOG,
    ExampleDownloadError,
    by_id,
    cached_path,
    fetch,
    is_stale,
)
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

# Un análisis a la vez (informe 2): evita OOM al cargar dos ventanas Prithvi en paralelo.
# No es cola de trabajos; solo un candado de exclusión mutua.
_infer_sem = threading.Semaphore(1)


@contextmanager
def _inference_slot():
    if not _infer_sem.acquire(blocking=False):
        raise HTTPException(
            503,
            "Hay un análisis en curso. Espera a que termine e inténtalo de nuevo.",
        )
    try:
        yield
    finally:
        _infer_sem.release()


def inference_busy() -> bool:
    """True si otro request ya ocupa el slot de inferencia."""
    busy = not _infer_sem.acquire(blocking=False)
    if not busy:
        _infer_sem.release()
    return busy


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
    dest_dir = get_settings().tune_artifacts_dir / "examples"
    return [
        ExampleInfo(
            id=s.id,
            task=s.task,
            label=s.label,
            filename=s.filename,
            size_bytes=s.size_bytes,
            blurb=s.blurb,
            cached=cached_path(s, dest_dir) is not None,
            refresh_on_use=True,
        )
        for s in CATALOG
    ]


@router.post(
    "/examples/{example_id}/analyze",
    response_model=None,
    status_code=201,
    summary="Analizar una escena oficial",
    responses={
        404: {"description": "Id de escena desconocido"},
        503: {"description": "No se pudo bajar la escena o cargar el modelo"},
    },
)
async def analyze_example(
    example_id: str = PathParam(description="india, spain, usa, t10seh, t10sff o t10sgf"),
    stream: bool = Query(
        False,
        description="Si true, responde NDJSON con progreso de descarga e inferencia",
    ),
    use_case: AnalyzeUseCase = Depends(get_use_case),
):
    """Consulta Hugging Face por datos nuevos, baja si hace falta y corre la tarea de la escena.

    Con ``stream=true`` emite líneas NDJSON:
    ``check``, ``download`` (loaded/total, refreshed), ``infer`` y ``done`` (analysis).
    """
    try:
        scene = by_id(example_id)
    except KeyError as exc:
        raise HTTPException(404, f"Escena de ejemplo desconocida: {example_id}") from exc
    dest_dir = get_settings().tune_artifacts_dir / "examples"

    if not stream:
        try:
            with _inference_slot():
                path, _refreshed = await run_in_threadpool(fetch, scene, dest_dir)
                analysis = await run_in_threadpool(
                    use_case.execute, path, HazardTask(scene.task), filename=scene.filename
                )
        except HTTPException:
            raise
        except Exception as exc:
            raise _http_for(exc) from exc
        return AnalysisResponse.from_domain(analysis)

    return _example_stream(scene, dest_dir, use_case)


def _example_stream(scene, dest_dir: Path, use_case: AnalyzeUseCase) -> StreamingResponse:
    """NDJSON: check → download → infer → done."""

    async def events():
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[dict | None] = asyncio.Queue()

        def on_progress(loaded: int, total: int) -> None:
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"phase": "download", "loaded": loaded, "total": total},
            )

        def work() -> None:
            claimed = False
            try:
                if not _infer_sem.acquire(blocking=False):
                    raise HTTPException(
                        503,
                        "Hay un análisis en curso. Espera a que termine e inténtalo de nuevo.",
                    )
                claimed = True
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {
                        "phase": "check",
                        "stale": is_stale(scene, dest_dir),
                    },
                )
                path, refreshed = fetch(scene, dest_dir, on_progress=on_progress, refresh=True)
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {
                        "phase": "download",
                        "loaded": path.stat().st_size,
                        "total": path.stat().st_size,
                        "refreshed": refreshed,
                    },
                )
                loop.call_soon_threadsafe(queue.put_nowait, {"phase": "infer"})
                analysis = use_case.execute(path, HazardTask(scene.task), filename=scene.filename)
                payload = AnalysisResponse.from_domain(analysis).model_dump(mode="json")
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {"phase": "done", "analysis": payload, "refreshed": refreshed},
                )
            except Exception as exc:  # noqa: BLE001 — se serializa al cliente
                http = _http_for(exc) if not isinstance(exc, HTTPException) else exc
                detail = http.detail if isinstance(http, HTTPException) else str(exc)
                status = http.status_code if isinstance(http, HTTPException) else 500
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {"phase": "error", "detail": detail, "status": status},
                )
            finally:
                if claimed:
                    _infer_sem.release()
                loop.call_soon_threadsafe(queue.put_nowait, None)

        task = asyncio.create_task(asyncio.to_thread(work))
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield json.dumps(item, ensure_ascii=False) + "\n"
        finally:
            await task

    return StreamingResponse(
        events(),
        media_type="application/x-ndjson",
        status_code=200,
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
            with _inference_slot():
                await run_in_threadpool(_validate_geotiff_bands, dest, task)
                analysis = await run_in_threadpool(
                    use_case.execute, dest, task, filename=file.filename
                )
        except HTTPException:
            raise
        except Exception as exc:
            raise _http_for(exc) from exc
    return AnalysisResponse.from_domain(analysis)


def _validate_geotiff_bands(path: Path, task: HazardTask) -> None:
    """Comprueba bandas antes de cargar el modelo (falla barato y con mensaje claro)."""
    try:
        import rasterio
    except ImportError:
        return
    from tune.infrastructure.inference.prithvi import MODEL_CARDS, PRITHVI_BANDS

    card = MODEL_CARDS[task]
    with rasterio.open(path) as src:
        n = src.count
        width, height = src.width, src.height
    if width * height > 64_000_000:
        raise ValueError(
            f"La imagen es demasiado grande ({width}×{height} px). "
            "Usa un recorte más pequeño o reduce la resolución."
        )
    if n == PRITHVI_BANDS:
        return
    if card.wide_input_indices and n > max(card.wide_input_indices):
        return
    need = f"{PRITHVI_BANDS} bandas Prithvi" + (
        f" o un Sentinel-2 L1C con más de {max(card.wide_input_indices)} bandas"
        if card.wide_input_indices
        else ""
    )
    raise ValueError(f"El raster tiene {n} bandas; se esperan {need}.")


def _http_for(exc: Exception) -> HTTPException:
    if isinstance(exc, ImportError):
        return HTTPException(503, str(exc))
    if isinstance(exc, ExampleDownloadError):
        return HTTPException(503, str(exc))
    if isinstance(exc, OSError):
        return HTTPException(422, f"GeoTIFF no válido: {exc}")
    if isinstance(exc, ValueError):
        return HTTPException(422, str(exc))
    if isinstance(exc, AssertionError):
        log.exception("AssertionError en inferencia/análisis")
        detail = str(exc).strip()
        if detail:
            return HTTPException(
                422,
                "No se pudo completar el análisis: "
                f"{detail}. "
                "Si subiste un archivo, usa 6 bandas Prithvi o Sentinel-2 L1C; "
                "si viene del catálogo, prueba otra fecha o un recorte más pequeño.",
            )
        return HTTPException(
            422,
            "El modelo rechazó la forma del tensor de entrada. "
            "Prueba una escena de ejemplo o otra fecha del catálogo; "
            "si subes GeoTIFF, verifica 6 bandas Prithvi (BLUE–SWIR2) o Sentinel-2 L1C.",
        )
    if isinstance(exc, MemoryError):
        return HTTPException(413, "Imagen demasiado grande para la memoria disponible")
    log.exception("Fallo de inferencia")
    detail = str(exc).strip() or type(exc).__name__
    return HTTPException(
        503,
        f"Fallo del modelo: {detail}. "
        "Prueba de nuevo, usa una escena de ejemplo o reduce el tamaño del recorte (lado km).",
    )


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
        description="mask_png, preview_png, mask_tif, input, change_png, reference_tif o fusion_png"
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
    "/geocode",
    summary="Buscar un lugar por nombre",
    responses={503: {"description": "El geocodificador no respondió"}},
)
def geocode(q: str = Query(..., min_length=2, max_length=120)) -> list[dict[str, float | str]]:
    """Resuelve nombres de lugar a coordenadas (Nominatim / OpenStreetMap)."""
    import urllib.error
    import urllib.parse
    import urllib.request

    query = q.strip()
    if not query:
        return []
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "json", "limit": 5}
    )
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "TuneFloodApp/0.1 (geocode; educational)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(503, f"No se pudo buscar el lugar: {exc}") from exc
    out: list[dict[str, float | str]] = []
    for row in payload:
        try:
            out.append(
                {
                    "label": str(row.get("display_name") or query),
                    "lat": float(row["lat"]),
                    "lon": float(row["lon"]),
                }
            )
        except (KeyError, TypeError, ValueError):
            continue
    return out


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
    side_km: float = Query(
        20.0,
        ge=1,
        le=50,
        description="Lado del recorte en km; tope efectivo en GET /api/catalog/limits",
    ),
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


@router.get(
    "/catalog/limits",
    summary="Límites del catálogo Sentinel-2",
)
def catalog_limits() -> dict:
    """Máximo de km de recorte y tareas admitidas en el catálogo Earth Search."""
    return {
        "max_side_km": get_settings().tune_catalog_max_km,
        "tasks": ["flood"],
        "collection": "sentinel-2-l2a",
        "note": "El catálogo STAC alimenta inundación (S2 L2A). Incendios: GeoTIFF HLS o ejemplo.",
    }


@router.post(
    "/catalog/{item_id}/analyze",
    response_model=None,
    status_code=201,
    summary="Analizar una escena del catálogo",
    responses={
        422: {"description": "Escena inválida, tarea no soportada o demasiado nublada"},
        503: {"description": "Análisis en curso, o no se pudo descargar / cargar el modelo"},
    },
)
async def catalog_analyze(
    item_id: str = PathParam(description="Id STAC de la escena"),
    task: HazardTask = Form(description="Solo flood (Sentinel-2 L2A)"),
    lat: float = Form(ge=-90, le=90),
    lon: float = Form(ge=-180, le=180),
    side_km: float = Form(
        20.0, ge=1, le=50, description="Lado del recorte en km (tope en /api/catalog/limits)"
    ),
    max_cloud: float = Form(40.0, ge=0, le=100),
    stream: bool = Query(
        False,
        description="Si true, responde NDJSON: download (bandas), infer, done (HTTP 200)",
    ),
    use_case: AnalyzeUseCase = Depends(get_use_case),
    catalog=Depends(get_catalog),
):
    """Descarga el recorte de 6 bandas y corre el análisis.

    Solo ``flood``: el catálogo es Sentinel-2 L2A; Burn Scars espera HLS.
    El tope real de ``side_km`` es ``TUNE_CATALOG_MAX_KM`` (ver ``GET /api/catalog/limits``).
    """
    if task is not HazardTask.FLOOD:
        raise HTTPException(
            422,
            "El catálogo Sentinel-2 solo admite inundación. "
            "Para cicatriz de incendio sube un GeoTIFF HLS o usa una escena de ejemplo.",
        )
    max_km = get_settings().tune_catalog_max_km
    if side_km > max_km:
        raise HTTPException(422, f"side_km máximo es {max_km}")

    bbox = bbox_from_point(lat, lon, side_km)
    dest = get_settings().tune_artifacts_dir / "catalog"

    if stream:
        return _catalog_stream(catalog, use_case, item_id, bbox, dest, max_cloud, task)

    try:
        with _inference_slot():
            path = await run_in_threadpool(
                catalog.fetch_six_bands,
                item_id,
                bbox,
                dest,
                max_cloud=max_cloud,
            )
            analysis = await run_in_threadpool(use_case.execute, path, task, filename=path.name)
    except CatalogError as exc:
        raise HTTPException(422, str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_for(exc) from exc
    return AnalysisResponse.from_domain(analysis)


def _catalog_stream(catalog, use_case, item_id, bbox, dest, max_cloud, task) -> StreamingResponse:
    """NDJSON: download (bandas 1..7) → infer → done."""

    async def events():
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[dict | None] = asyncio.Queue()

        def on_progress(loaded: int, total: int) -> None:
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"phase": "download", "loaded": loaded, "total": total},
            )

        def work() -> None:
            claimed = False
            try:
                if not _infer_sem.acquire(blocking=False):
                    raise HTTPException(
                        503,
                        "Hay un análisis en curso. Espera a que termine e inténtalo de nuevo.",
                    )
                claimed = True
                path = catalog.fetch_six_bands(
                    item_id, bbox, dest, max_cloud=max_cloud, on_progress=on_progress
                )
                loop.call_soon_threadsafe(queue.put_nowait, {"phase": "infer"})
                analysis = use_case.execute(path, task, filename=path.name)
                payload = AnalysisResponse.from_domain(analysis).model_dump(mode="json")
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {"phase": "done", "analysis": payload},
                )
            except Exception as exc:  # noqa: BLE001
                if isinstance(exc, CatalogError):
                    http = HTTPException(422, str(exc))
                elif isinstance(exc, HTTPException):
                    http = exc
                else:
                    http = _http_for(exc)
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {"phase": "error", "detail": http.detail, "status": http.status_code},
                )
            finally:
                if claimed:
                    _infer_sem.release()
                loop.call_soon_threadsafe(queue.put_nowait, None)

        task_bg = asyncio.create_task(asyncio.to_thread(work))
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield json.dumps(item, ensure_ascii=False) + "\n"
        finally:
            await task_bg

    return StreamingResponse(
        events(),
        media_type="application/x-ndjson",
        status_code=200,
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
