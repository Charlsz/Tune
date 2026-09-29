# ADR 007 — Timeline por territorio

**Fecha:** 2026-09-28 · **Estado:** Aceptado · **Sigue a:** [ADR 006](./006-metadatos-geotiff.md)

## Contexto

Varios análisis pueden cubrir el mismo lugar (la misma escena en otra fecha, o un recorte dentro de una escena grande). El historial los lista por fecha de corrida, no por territorio ni por fecha de adquisición.

## Decisión

Dos cajas en EPSG:4326 son el mismo territorio cuando la intersección cubre al menos la mitad de la caja más chica. Un recorte que cae entero dentro de una escena grande entra. Dos escenas que apenas se tocan no.

`GET /api/timeline` acepta `analysis_id` o `lat` y `lon`, y `task` opcional. Devuelve los análisis de ese territorio del más antiguo al más reciente. Ordena por `acquired_at` y, si falta, por `created_at` (la web marca esas como “fecha de análisis”). Un análisis sin bounds no se agrupa.

La lista sale de `repo.list(limit=10_000)`. Es un escaneo O(n) de `analysis.json`. Se reemplaza por PostGIS si el historial crece. La ruta no cuelga de `/api/analyses/{id}/…` para no chocar con la de artefactos.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Buscar escenas Sentinel-2 en un catálogo STAC y analizarlas | El informe deja fuera la descarga automática; cada escena tarda minutos en CPU |
| Mismo territorio = mismo nombre de archivo | No agrupa un recorte con la escena de la que sale |

## Consecuencias

- Con un solo análisis del lugar, la franja lo dice y no dibuja una serie de un punto.
- Inundación y cicatriz conviven en la misma línea; el filtro de tarea las separa.
