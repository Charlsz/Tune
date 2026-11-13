# Informe — flujo mapa-primero (`feature/tune-map-first-workflow`)

**Fecha:** 2026-11-13  
**Base:** `feature/tune-stabilization-map` @ `57fb707`  
**Rama:** `feature/tune-map-first-workflow`

---

## 1. Resumen

Tune pasa de una home densa (formulario + mapa embebido) a un **workspace geoespacial**:

- **Izquierda (~65–70 %):** mapa Leaflet a altura completa.
- **Derecha:** panel contextual por estados (idle → borrador → listo → buscando → escenas → preparado → resultado).
- Selección **punto** (centro + `side_km`) y **rectángulo** (bbox exacto).
- Búsqueda STAC con AOI confirmado; ranking determinista de escenas; CTA único **Analizar agua nueva**.
- Resultados georreferenciados como `ImageOverlay` cuando `Analysis.bounds` existe.

---

## 2. Capacidades reutilizadas (preservadas)

| Capacidad | Estado |
|---|---|
| Catálogo Earth Search S2 L2A | Conservado |
| Contrato `lat/lon/side_km` | Conservado (+ `bbox` opcional) |
| Inferencia Prithvi / stream NDJSON | Conservado |
| Casos Sindh / Magdalena / Mississippi | Conservados |
| Historial / AnalysisPage / How to use / Docs | Conservados |
| GeoTIFF avanzado (vista clásica en código) | Código `HomeScreen`/`CompareFloodCatalog` intacto; Inicio usa mapa-primero |
| Significado científico (agua ≠ inundación confirmada) | Conservado en copy |

---

## 3. Modelo de AOI

Tipo canónico en `web/src/lib/aoi.ts`:

- `point`: `{ center, sideKm, bbox }` — bbox = `bboxFromPoint` (misma fórmula que backend).
- `rectangle`: `{ bbox }` — el bbox dibujado es el que se envía; **no** se convierte silenciosamente a cuadrado.

API:

- `GET /api/catalog/search?...&bbox=west,south,east,north` (opcional; sustituye punto/`side_km` para la geometría de consulta).
- `POST /api/catalog/{id}/analyze` form `bbox` opcional = ventana exacta de descarga.

Límites: `TUNE_CATALOG_MAX_KM` (validación de lado máx. del bbox).  
Distancias/áreas en UI: aproximación plana (cos lat); documentada en panel «Más».

---

## 4. Selección de escenas

`web/src/lib/sceneRank.ts` — determinista:

`score = cobertura_AOI×0.55 + (1 − nubes/max)×0.35 + 0.10`

Cobertura = intersección bbox escena ∩ AOI / área AOI (aproximación planar).  
La nubosidad de lista es de **escena completa**; la del recorte se valida en backend (SCL) como antes.

---

## 5. Caché / historial

`findCompatibleAnalysis` exige fecha + solape de bounds + escala de AOI similar (±1,5 km).  
Opcionalmente coincide por sufijo de id en `input_filename`.  
**Ya no** se reutiliza un análisis solo por fecha.

Descargas de catálogo: nombre `S2_{stamp}_{item8}_{aoi_tag}.tif` para no pisar otro AOI.

---

## 6. Cámara del mapa

`fitBounds` solo ante cambio de ubicación / «Ajustar» (`fitKey`).  
Cambiar el slider de recorte **no** recentra (corregido también en `LocationMap` legado).

Modo rectángulo: `map.dragging` y `boxZoom` desactivados; listeners `document` para mouseup.

---

## 7. Archivos principales

**Backend:** `stac.py`, `analyses.py`, `ports.py`, tests STAC/API.  
**Frontend:** `aoi.ts`, `sceneRank.ts`, `analysisMatch.ts`, `MapCanvas.tsx`, `MapFirstHome.tsx`, `HomePage.tsx`, `api.ts`, `App.tsx`, `styles.css`.

---

## 8. Pruebas

| Suite | Resultado |
|---|---|
| Vitest | **28 passed** |
| `tsc -b` / `vite build` | **OK** (chunk JS ~640 kB; MapFirst lazy) |
| Pytest STAC + API analyses | **35 passed** |
| Ruff (archivos tocados) | **OK** |
| Smoke UI (computer use) | Layout, punto, slider, casos verificados, rectángulo ≤30 km **OK** |
| Inferencia ML end-to-end | **No ejecutada** (sin torch/GPU en este entorno) |
| STAC real bbox Bogotá | 0 escenas en rango demo (esperado); Sindh sí |

---

## 9. Rendimiento

| Métrica | Antes (home densa) | Después |
|---|---|---|
| Bundle JS gzip | ~similar orden (Leaflet) | `index` ~210 kB gzip; MapFirst en chunk lazy |
| Solicitudes al arrastrar slider | Riesgo de STAC + fitBounds | STAC solo tras confirmar / «Buscar»; sin fitBounds por tick |
| Scroll hasta CTA | ~10+ pantallas | Panel fijo; mapa full-height |

No se midió Lighthouse ni memoria de forma cuantitativa en este entorno.

---

## 10. Limitaciones

1. Inferencia real no verificada aquí (falta runtime `inference`/GPU).
2. Cobertura de escena usa bbox STAC, no geometría precisa del footprint.
3. Overlay de resultado depende de `bounds` + PNG; sin `bounds` se indica ir a Análisis.
4. Antes/Después como capas satélite crudas no están (solo máscaras/preview del análisis).
5. Vista clásica (`HomeScreen`) no está enlazada en la UI nueva (código conservado).

---

## 11. Estado por funcionalidad

| Ítem | Estado |
|---|---|
| Layout mapa / panel | Implementada y verificada |
| Punto + side_km | Implementada y verificada |
| Rectángulo + bbox API | Implementada y verificada |
| STAC por AOI | Implementada y verificada (red) |
| Ranking de escenas | Implementada y verificada (unit) |
| Analizar agua nueva | Implementada, **pendiente** validación ML externa |
| Overlay georref. | Implementada; verificado layout/código, no tras inferencia real |
| Caché compatible | Implementada y verificada (unit) |
| Historial / demos | Preservados |
