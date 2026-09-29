"""Riesgo futuro en un punto. No lo calcula Prithvi.

Inundación: caudal GloFAS v4 (Open-Meteo Flood API), probabilidad de que el ensamble
supere el percentil 90 histórico de esa celda.
Incendio: índice Hot-Dry-Windy en superficie (VPD × viento) con el pronóstico horario
de Open-Meteo. Las funciones puras no tocan la red.
"""

from __future__ import annotations

import json
import statistics
from functools import lru_cache
from urllib.error import URLError
from urllib.request import Request, urlopen

FLOOD_API = "https://flood-api.open-meteo.com/v1/flood"
WEATHER_API = "https://api.open-meteo.com/v1/forecast"
# ponytail: cortes absolutos de HDW (hPa·m/s). Lo correcto es el percentil local
# con la API histórica de Open-Meteo; estos números solo ordenan la demo.
HDW_MEDIO = 50
HDW_ALTO = 150
HDW_EXTREMO = 300


class ForecastError(RuntimeError):
    """Open-Meteo no respondió o la respuesta no trae la serie esperada."""


def percentile90(values: list[float]) -> float:
    clean = [v for v in values if v is not None]
    if not clean:
        raise ValueError("sin valores")
    if len(clean) < 2:
        return float(clean[0])
    # inclusive, n=10: el corte 9 de 10 es el percentil 90.
    return float(statistics.quantiles(clean, n=10, method="inclusive")[8])


def flood_probability(
    members: list[list[float | None]], threshold: float
) -> tuple[list[float], float]:
    """Fracción de miembros sobre el umbral, por día, y en algún día del horizonte.

    Un valor ``None`` no cuenta ese miembro en ese día. El horizonte es la fracción
    de miembros que superan el umbral al menos una vez.
    """
    if not members:
        return [], 0.0
    days = max(len(member) for member in members)
    daily: list[float] = []
    for day in range(days):
        sample = [
            member[day] for member in members if day < len(member) and member[day] is not None
        ]
        if not sample:
            daily.append(0.0)
            continue
        daily.append(sum(value > threshold for value in sample) / len(sample))
    usable = [member for member in members if any(value is not None for value in member)]
    if not usable:
        return daily, 0.0
    hit = sum(any(value is not None and value > threshold for value in member) for member in usable)
    return daily, hit / len(usable)


def hdw_daily(
    times: list[str], vpd_kpa: list[float | None], wind_ms: list[float | None]
) -> list[tuple[str, float]]:
    """Máximo diario de VPD (hPa) × viento (m/s). Open-Meteo entrega el VPD en kPa."""
    by_day: dict[str, float] = {}
    for stamp, vpd, wind in zip(times, vpd_kpa, wind_ms, strict=False):
        if vpd is None or wind is None:
            continue
        day = stamp[:10]
        hdw = (vpd * 10.0) * wind
        if day not in by_day or hdw > by_day[day]:
            by_day[day] = hdw
    return [(day, by_day[day]) for day in sorted(by_day)]


def hdw_level(value: float) -> str:
    if value >= HDW_EXTREMO:
        return "extremo"
    if value >= HDW_ALTO:
        return "alto"
    if value >= HDW_MEDIO:
        return "medio"
    return "bajo"


def worst_level(levels: list[str]) -> str | None:
    rank = {"bajo": 0, "medio": 1, "alto": 2, "extremo": 3}
    if not levels:
        return None
    return max(levels, key=lambda level: rank[level])


def ensemble_members(daily: dict) -> list[list[float | None]]:
    keys = sorted(key for key in daily if key.startswith("river_discharge_member"))
    if not keys:
        raise ForecastError("El pronóstico no trae miembros del ensamble")
    return [list(daily[key]) for key in keys]


# --- red -----------------------------------------------------------------------


def _get_json(url: str) -> dict:
    request = Request(url, headers={"User-Agent": "tune-forecast"})
    try:
        with urlopen(request, timeout=60) as response:
            payload = json.load(response)
    except (URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        raise ForecastError(f"No se pudo consultar el pronóstico: {exc}") from exc
    if payload.get("error"):
        raise ForecastError(payload.get("reason") or "Pronóstico rechazado")
    return payload


@lru_cache(maxsize=32)
def _discharge_p90(lat: float, lon: float) -> float:
    # ponytail: umbral = p90 del caudal diario 1984–2022, no el periodo de retorno
    # de 2 o 5 años que publica GloFAS.
    url = (
        f"{FLOOD_API}?latitude={lat}&longitude={lon}&daily=river_discharge"
        "&start_date=1984-01-01&end_date=2022-07-31"
    )
    series = _get_json(url)["daily"]["river_discharge"]
    try:
        return percentile90(series)
    except (KeyError, ValueError, TypeError) as exc:
        raise ForecastError("El histórico de caudal no trae datos") from exc


def flood_outlook(lat: float, lon: float) -> dict:
    url = (
        f"{FLOOD_API}?latitude={lat}&longitude={lon}"
        "&daily=river_discharge&ensemble=true&forecast_days=30"
    )
    payload = _get_json(url)
    daily = payload["daily"]
    members = ensemble_members(daily)
    cell_lat = round(float(payload["latitude"]), 4)
    cell_lon = round(float(payload["longitude"]), 4)
    threshold = _discharge_p90(cell_lat, cell_lon)
    probabilities, horizon = flood_probability(members, threshold)
    return {
        "task": "flood",
        "source": "GloFAS v4 (Open-Meteo)",
        "note": "GloFAS, río más grande a unos 5 km. Prithvi no calcula este pronóstico.",
        "cell": {"lat": payload["latitude"], "lon": payload["longitude"]},
        "horizon_days": len(daily["time"]),
        "probability": horizon,
        "level": None,
        "threshold": threshold,
        "threshold_unit": "m³/s",
        "daily": [
            {"date": day, "probability": probability, "value": None, "level": None}
            for day, probability in zip(daily["time"], probabilities, strict=False)
        ],
    }


def burn_outlook(lat: float, lon: float) -> dict:
    url = (
        f"{WEATHER_API}?latitude={lat}&longitude={lon}"
        "&hourly=vapour_pressure_deficit,wind_speed_10m"
        "&wind_speed_unit=ms&forecast_days=16&timezone=GMT"
    )
    payload = _get_json(url)
    hourly = payload["hourly"]
    days = hdw_daily(hourly["time"], hourly["vapour_pressure_deficit"], hourly["wind_speed_10m"])
    if not days:
        raise ForecastError("El pronóstico de viento y sequedad no trae horas válidas")
    levels = [hdw_level(value) for _, value in days]
    return {
        "task": "burn_scar",
        "source": "Hot-Dry-Windy (Open-Meteo)",
        "note": "VPD de superficie por viento, 16 días. Prithvi no calcula este pronóstico.",
        "cell": {"lat": payload["latitude"], "lon": payload["longitude"]},
        "horizon_days": len(days),
        "probability": None,
        "level": worst_level(levels),
        "threshold": None,
        "threshold_unit": None,
        "daily": [
            {"date": day, "probability": None, "value": value, "level": level}
            for (day, value), level in zip(days, levels, strict=True)
        ],
    }
