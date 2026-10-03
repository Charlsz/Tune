# Validación JRC Global Surface Water

**Fecha:** 2026-10-03 · **Estado:** Plantilla (rellenar con corridas reales)

## Fuente

JRC GSW v1.4, capa `occurrence` (Pekel et al., 2016). Umbral de permanente: 75 %.
Tiles: `occurrence_{LON}{LAT}v1_4_2021.tif` en Google Cloud Storage.

## Controles previstos

| Caso | Esperado | Resultado | Notas |
|---|---|---|---|
| Escena oficial `spain` | `persistent_km2 > 0` y `new_km2 < affected_km2` | Pendiente | Cauce visible |
| Magdalena en época seca | `affected_km2 > 0` y `new_km2 / affected_km2` bajo | Pendiente | Caso Zenen |
| Misma zona en evento de inundación | `new_km2` claramente mayor que en seca | Pendiente | Tras catálogo STAC |

## Comando

```bash
# Tras levantar la API con pesos cacheados:
curl -s "http://localhost:8000/api/examples/spain/analyze" -X POST | jq '.change, .affected_area_km2'
```

Los números de las corridas reales se anotan aquí cuando se ejecute el piloto (Fase 6).
