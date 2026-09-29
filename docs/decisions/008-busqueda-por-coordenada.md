# ADR 008 — Búsqueda por coordenada

**Fecha:** 2026-09-28 · **Estado:** Aceptado · **Sigue a:** [ADR 007](./007-timeline-territorio.md)

## Contexto

El timeline agrupa por solape de cajas. Para “¿qué hemos analizado en este punto?” hace falta el caso estricto: la caja contiene la coordenada. Ese punto también es la entrada del pronóstico (ADR 009).

## Decisión

`GET /api/analyses` acepta `lat`, `lon` y `task`. `lat` y `lon` van juntos; los rangos los valida FastAPI (−90…90 y −180…180). El filtro reutiliza `covers`: bordes incluidos. Con filtro se leen los `analysis.json` y después se aplica `limit`. Sin filtro el historial sigue igual (más reciente primero, sin barrer todo el disco).

La web acepta `4.71, -74.07`. Si el texto no tiene esa forma, o la coordenada se sale del rango, no llama a la API. Mientras la búsqueda está activa, el timeline pide `GET /api/timeline?lat=&lon=` (los análisis que cubren el punto, por fecha) y el punto queda en el estado de la página para el pronóstico.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Reutilizar `same_territory` para la búsqueda | Una escena vecina que solo solapa la mitad no “cubre” el punto |
| Geocodificar un nombre de municipio | No hay catálogo de lugares; la demo ya tiene lat/lon en el análisis |

## Consecuencias

- Un punto fuera de toda caja deja el historial vacío, con un texto que lo dice, y no borra los análisis.
- Una latitud sola responde 422.
