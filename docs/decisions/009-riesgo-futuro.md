# ADR 009 — Riesgo futuro de inundación y de incendio

**Fecha:** 2026-09-28 · **Estado:** Aceptado · **Sigue a:** [ADR 008](./008-busqueda-por-coordenada.md)

## Contexto

Prithvi clasifica el agua o la cicatriz que hay en el GeoTIFF de hoy. No pronostica. El segundo informe deja fuera las consultas a Copernicus; esta decisión añade una consulta externa acotada, distinta para cada tarea, sobre el centro de la escena o el punto buscado (ADR 008).

## Decisión

`GET /api/forecast?task=&lat=&lon=` no carga Prithvi.

- **Inundación.** Caudal GloFAS v4 vía Open-Meteo Flood API (`flood-api.open-meteo.com`), 30 días, 50 miembros (`river_discharge_member01`…`50`). La probabilidad de un día es la fracción de miembros que supera el umbral; la del horizonte es la fracción que lo supera al menos un día. El umbral es el percentil 90 del caudal diario entre 1984-01-01 y 2022-07-31 de la celda (el río más grande a unos 5 km), cacheado por celda en el proceso.
- **Incendio.** Hot-Dry-Windy en superficie: máximo diario de VPD × viento a 10 m, 16 días (`api.open-meteo.com`). Open-Meteo entrega el VPD en kPa; el índice se define en hPa, así que se multiplica por 10. Niveles absolutos, en hPa·m/s: bajo por debajo de 50, medio por debajo de 150, alto por debajo de 300, extremo desde 300.

Si Open-Meteo falla, la API responde 503 y el historial no se toca. La tarjeta dice que Prithvi no calcula ese número.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Entrenar un modelo de pronóstico | Fuera del plazo y del informe |
| Frecuencia histórica de los análisis de Tune | No es un pronóstico; con una sola escena el porcentaje no dice nada |
| Fire Weather Index de Copernicus/EFFIS | Pide cuenta y NetCDF |
| NASA FIRMS | Focos de los últimos días, no un pronóstico, y pide MAP_KEY |
| Mismos cortes de HDW como si fueran climatología local | El índice no tiene umbral universal; los cortes solo ordenan la demo |

## Consecuencias

- La primera consulta de inundación de una celda baja el histórico 1984–2022. Las siguientes leen la caché del proceso.
- El umbral de caudal no es el periodo de retorno de 2 o 5 años de GloFAS. El nivel de incendio no es un percentil del lugar. Esas dos son la mejora si el pronóstico pasa de demo a resultado que se defiende.
- Hay que decirlo en el informe: la sección 3.4 del segundo informe no incluye esta consulta externa.
