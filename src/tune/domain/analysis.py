"""Entidades del caso de uso principal: análisis de una imagen satelital con Prithvi.

Sin numpy ni torch aquí: la máscara cruda vive en la capa de infraestructura;
el dominio guarda lo que se muestra, se persiste y se compara.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class HazardTask(str, Enum):
    """Tarea de segmentación. Cada valor mapea a un checkpoint publicado por IBM-NASA."""

    FLOOD = "flood"
    BURN_SCAR = "burn_scar"


@dataclass(frozen=True)
class GeoBounds:
    """Caja envolvente en EPSG:4326 (lo que entiende un mapa web)."""

    west: float
    south: float
    east: float
    north: float


@dataclass(frozen=True)
class SegmentationOutput:
    """Lo que devuelve el segmentador antes de calcular estadísticas.

    ``mask`` es un array 2D (H, W) de enteros con la clase por píxel; se tipa ``Any``
    para no arrastrar numpy al dominio. ``valid`` marca píxeles con dato.
    """

    mask: Any
    valid: Any
    model_id: str
    positive_class: int
    class_names: tuple[str, ...]
    crs: str | None
    bounds: GeoBounds | None
    pixel_area_m2: float | None
    raster_meta: dict[str, Any] = field(default_factory=dict)
    rgb_preview: Any | None = None  # (3, H, W) uint8 opcional para el mapa


@dataclass(frozen=True)
class Analysis:
    """Resultado persistido de un análisis (lo que ve la UI y la API)."""

    id: str
    task: HazardTask
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
    bounds: GeoBounds | None
    latency_s: float
    artifacts: dict[str, str] = field(default_factory=dict)  # nombre -> path relativo
