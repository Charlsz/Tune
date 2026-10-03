# ADR 012 — Serie temporal y sectores críticos

**Fecha:** 2026-10-03 · **Estado:** Aceptado · **Sigue a:** [ADR 010](./010-inundacion-como-cambio.md)

## Contexto

El timeline agrupaba análisis del mismo territorio pero no medía progresión ni priorizaba zonas. El profesor pidió imágenes diarias con progresión e identificación de sectores más críticos.

## Decisión

- `GET /api/timeline/series` resume km² afectados / nuevos / permanentes / retirados por fecha.
- `GET /api/analyses/{a}/diff/{b}` compara dos máscaras (B como referencia sobre la grilla de A).
- `GET /api/analyses/{id}/sectors` agrega agua nueva (o afectada) en celdas de ~1 km y las rankea.
- La UI muestra el bloque "Frente a referencia" y usa km² nuevos en las barras del timeline cuando existen.

## Consecuencias

La cifra que se defiende como inundación es `new_km2`, no el porcentaje de agua del modelo. Sin `change`, los sectores usan la máscara afectada completa y marcan `basis: affected`.
