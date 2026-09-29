"""Contratos de la API (plan.md, Fase 5.3: la versión del modelo viaja en la respuesta)."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from pydantic import BaseModel, Field

from tune.domain.analysis import Analysis


class HealthResponse(BaseModel):
    status: str = Field("ok", description="ok si el proceso responde")
    version: str = Field(description="Versión del paquete tune")


class ModelInfoResponse(BaseModel):
    name: str = Field(description="Nombre en el Model Registry del laboratorio")
    alias: str = Field(description="Alias servido, por defecto approved")
    version: str | None = Field(None, description="None si aún no hay modelo aprobado")
    loaded: bool = Field(description="True si el predictor del laboratorio cargó")


class PredictResponse(BaseModel):
    result: Any = Field(description="Salida del predictor del laboratorio")
    model_version: str = Field(description="Versión del modelo que respondió")
    latency_ms: float = Field(description="Tiempo de la predicción, en milisegundos")


class TaskInfo(BaseModel):
    id: str = Field(description="flood o burn_scar")
    label: str = Field(description="Nombre legible de la tarea")
    model_id: str = Field(description="Repositorio Hugging Face del checkpoint")
    classes: list[str] = Field(description="Clase negativa y clase positiva, en ese orden")


class ForecastDay(BaseModel):
    date: str = Field(description="Día del pronóstico, YYYY-MM-DD")
    probability: float | None = Field(
        None, description="Fracción del ensamble sobre el umbral. Solo inundación"
    )
    value: float | None = Field(None, description="Hot-Dry-Windy del día. Solo incendio")
    level: str | None = Field(None, description="bajo, medio, alto o extremo. Solo incendio")


class ForecastCell(BaseModel):
    lat: float = Field(description="Latitud de la celda que usó el pronóstico")
    lon: float = Field(description="Longitud de la celda que usó el pronóstico")


class ForecastResponse(BaseModel):
    task: str = Field(description="flood o burn_scar")
    source: str = Field(description="GloFAS v4 o Hot-Dry-Windy, vía Open-Meteo")
    note: str = Field(description="Aviso de que Prithvi no calcula este número")
    cell: ForecastCell
    horizon_days: int = Field(description="30 días en inundación, 16 en incendio")
    probability: float | None = Field(
        None, description="Fracción de miembros que superan el caudal algún día. Solo inundación"
    )
    level: str | None = Field(None, description="Nivel del día más alto. Solo incendio")
    threshold: float | None = Field(
        None, description="Percentil 90 del caudal histórico, m³/s. Solo inundación"
    )
    threshold_unit: str | None = Field(None, description="Unidad del umbral")
    daily: list[ForecastDay]


class ExampleInfo(BaseModel):
    id: str = Field(description="Identificador corto: india, spain, usa, t10seh, t10sff, t10sgf")
    task: str = Field(description="Tarea fija de esa escena")
    label: str = Field(description="Nombre que muestra la web")
    filename: str = Field(description="Archivo GeoTIFF en el repo de Hugging Face")
    size_bytes: int = Field(description="Tamaño aproximado del archivo")


class BoundsSchema(BaseModel):
    west: float = Field(description="Longitud oeste, EPSG:4326")
    south: float = Field(description="Latitud sur, EPSG:4326")
    east: float = Field(description="Longitud este, EPSG:4326")
    north: float = Field(description="Latitud norte, EPSG:4326")


class AnalysisResponse(BaseModel):
    id: str = Field(description="Identificador de 12 caracteres")
    task: str = Field(description="flood o burn_scar")
    created_at: str = Field(description="Momento en que Tune corrió el análisis, ISO 8601")
    model_id: str = Field(description="Checkpoint de Hugging Face usado")
    input_filename: str = Field(description="Nombre del GeoTIFF de entrada")
    width: int = Field(description="Ancho de la máscara, en píxeles")
    height: int = Field(description="Alto de la máscara, en píxeles")
    valid_pixels: int = Field(description="Píxeles con dato. El porcentaje no cuenta el nodata")
    affected_pixels: int = Field(description="Píxeles de la clase positiva y válidos")
    affected_ratio: float = Field(
        description="affected_pixels / valid_pixels. 0 si no hay píxeles válidos"
    )
    affected_area_km2: float | None = Field(
        None, description="Área de la clase positiva. Null sin tamaño de píxel"
    )
    crs: str | None = Field(None, description="CRS del raster. Null si el TIFF no trae coordenadas")
    bounds: BoundsSchema | None = Field(None, description="Caja en EPSG:4326. Null sin CRS")
    latency_s: float = Field(description="Segundos de la inferencia, sin contar la subida")
    artifacts: dict[str, str] = Field(description="nombre -> URL bajo /api/analyses/{id}/{nombre}")
    acquired_at: str | None = Field(
        None, description="Fecha de la toma (YYYY-MM-DD). Null si no se pudo leer"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Driver, bandas, resolución, sensor y tags del GeoTIFF"
    )

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
            acquired_at=a.acquired_at,
            metadata=a.metadata,
        )
