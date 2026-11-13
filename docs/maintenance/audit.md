# Auditoría de mantenimiento — Tune

**Fecha:** 2026-11-13  
**Rama de trabajo:** `feature/tune-stabilization-map`  
**Commit base:** `785a6b6` (`main`)  
**Respaldo histórico verificado:** `origin/backup/mlops-finetuning-lab` (`b7eec22`)

## Resumen ejecutivo

Tune en producción es una aplicación de **análisis de inundación** (Prithvi-EO 2.0 + STAC + cambio frente a referencia + exposición). El árbol `lab/` y el pipeline de fine-tuning / MLflow **no participan** en el flujo HTTP de inundación, pero siguen siendo material académico recuperable. Las dependencias del extra `training` (torch, terratorch, rasterio, …) **sí son necesarias** para la inferencia: el nombre del extra es engañoso.

Clasificación usada:

| Etiqueta | Significado |
|---|---|
| **App** | Necesario para la aplicación actual de inundación |
| **Deploy** | Necesario para compatibilidad o despliegue |
| **Académico** | Histórico, valioso para el trabajo de grado |
| **Obsoleto** | Seguro de retirar tras actualizar tests/docs |
| **Dudoso** | Conservar hasta verificar impacto |

---

## 1. Arquitectura

| Componente | Ruta | Clasificación | Evidencia |
|---|---|---|---|
| Dominio EO | `src/tune/domain/analysis.py`, puertos EO en `ports.py` | **App** | `HazardSegmenter`, `Analysis`, cambio/fusión/exposición |
| Dominio lab | `src/tune/domain/entities.py`, puertos de training | **Académico** | `TrainingConfig`, registry/tracker |
| Aplicación EO | `analyze.py`, `change.py`, `fusion.py`, `exposure.py`, `territory.py`, `series.py`, `sectors.py` | **App** | Orquestación del flujo de inundación |
| Stages MLOps | `src/tune/application/stages/*` | **Académico** | Solo CLI + tests de stages |
| Inferencia Prithvi | `src/tune/infrastructure/inference/prithvi.py` | **App** | `PrithviSegmenter` + `MODEL_CARDS` |
| RegistryPredictor | `inference/__init__.py` | **Académico** | Rutas `/model` y `/predict` |
| Análisis / historial | `infrastructure/analyses/` | **App** | Persistencia en `artifacts/analyses/` |
| Catálogo STAC | `infrastructure/catalog/stac.py` | **App** | Earth Search Sentinel-2 L2A |
| Referencia agua | `infrastructure/reference/` (JRC, history, composite) | **App** | Agua permanente / baseline |
| Observación | `infrastructure/observation/` | **App** | GFM / OPERA opcional |
| Exposición | `infrastructure/exposure/` | **App** | WorldCover + población |
| Training / tracking / registry | `infrastructure/training|tracking|registry/` | **Académico** | No usados por `AnalyzeUseCase` |
| Contenedor DI | `infrastructure/container.py` | **App** + **Académico** | Mezcla wiring EO y lab |
| API producto | `interfaces/api/analyses.py` | **App** | Prefijo `/api` |
| API lab/ops | `interfaces/api/main.py` (`/health`, `/model`, `/predict`) | **Deploy** (`/health`) / **Dudoso** (lab) | OpenAPI marca lab |
| CLI | `interfaces/cli/main.py` | **App** (`analyze`) + **Académico** (train…) | — |
| SPA | `web/` | **App** | Flujo flood-only en UI |
| Laboratorio | `lab/` | **Académico** | Sin `import lab` en `src/`/`web/`/`deploy/` |
| Docker producto | `docker-compose.yml`, `docker/eo/`, `web/` nginx | **Deploy** | — |
| Docker lab | `lab/docker-compose.yml` | **Académico** | MLflow + training |
| HF Space | `deploy/hf-space/` | **Deploy** | Contenedor único API+SPA |

---

## 2. Flujo de inundación (principio a fin)

1. Usuario elige ubicación (coords / geocode / presets) y `side_km`.
2. `GET /api/catalog/search` → STAC; lista escenas con nubosidad.
3. `POST /api/catalog/{item_id}/analyze` descarga 6 bandas Sentinel-2 y ejecuta Prithvi.
4. `AnalyzeUseCase`: segmentación → stats → referencia (historial → JRC) → cambio → fusión observación → exposición → persistencia.
5. UI: máscaras, comparación Antes/Después, timeline, historial.

Entradas alternativas: `POST /api/analyze` (GeoTIFF) y `POST /api/examples/{id}/analyze`.

**Clasificación del flujo completo:** **App**.

---

## 3. Dependencias

| Extra | Uso real | Clasificación |
|---|---|---|
| (core) | pydantic, typer, yaml | **App** |
| `api` | FastAPI, rasterio, pystac-client, … | **App** / **Deploy** |
| `training` | torch, terratorch, einops, hf_hub, … | **App** (inferencia) pese al nombre |
| `tracking` | mlflow | **Académico** / opcional; compose usa `TUNE_TRACKER=json` |
| `dev` | pytest, ruff, httpx | **Deploy** (CI) |

**web:** React 19, Vite 6, react-router, GSAP, Vitest — **App**. Sin mapa aún (pendiente de esta rama).

**Acción recomendada:** exponer un extra `inference` alias de las deps de runtime de Prithvi; no eliminar torch/terratorch al “retirar training”.

---

## 4. API expuesta

### Producto (`/api/*`) — **App**

`/tasks`, `/examples`, `/analyze`, `/examples/{id}/analyze`, `/analyses`, timeline/series/diff/sectors, `/geocode`, `/catalog/search`, `/catalog/limits`, `/catalog/{id}/analyze`, artefactos.

### Ops / lab (`main.py`)

| Ruta | Clasificación |
|---|---|
| `GET /health` | **Deploy** |
| `GET /model` | **Dudoso** (lab; no lo llama la web) |
| `POST /predict` | **Dudoso** (lab; no es análisis GeoTIFF) |

---

## 5. Frontend

| Ruta UI | Clasificación |
|---|---|
| `/` Home + CompareFloodCatalog | **App** |
| `/analysis` SceneStage, Stats, Timeline, PairCompare | **App** |
| `/history` | **App** |
| `/how-to-use`, `/docs` | **App** |

Burn Scars: **no seleccionable en UI** (`App.tsx` filtra `flood`). Backend/CLI/ejemplos burn: **Dudoso / Académico** — conservar.

---

## 6. STAC, referencia, cambio, exposición

| Pieza | Clasificación |
|---|---|
| `catalog/stac.py`, `bbox_from_point` | **App** |
| Observation STAC (GFM) | **App** (fallo graceful) |
| JRC + history + composite | **App** |
| `change.py`, `fusion.py`, exposure | **App** |

---

## 7. Persistencia e historial

`FileAnalysisRepository` bajo `artifacts/analyses/<id>/` — **App**.  
Trackers/registries de modelos — **Académico**.

---

## 8. Prithvi / TerraTorch / Burn Scars

| Pieza | Clasificación |
|---|---|
| Flood card Sen1Floods11 | **App** |
| BurnScars card | **Dudoso** (API/CLI; UI oculta) |
| Sliding window / bandas / helpers | **App** |
| `HazardSegmenter` Protocol | **App** (extensibilidad futura sin marketplace) |

---

## 9. Docker y despliegue

Compose `eo-api` + `web`, override GPU, HF Space — **Deploy**.  
Imagen EO instala `.[training,tracking,api]`; HF Space `.[api,training]`.  
`Dockerfile.cpu` copia `lab/scripts` — acoplamiento blando **Dudoso** para imagen solo producto.

---

## 10. Pruebas existentes

**App / EO:** `test_analyze`, `test_change`, `test_jrc_*`, `test_history_*`, `test_fusion`, `test_exposure`, `test_stac_catalog`, `test_observation`, `test_prithvi_helpers`, `test_api_analyses`, vitest web, etc.

**Lab:** `test_stages`, `test_promotion_policy`, `test_json_tracker`, `test_prepare_data`, `test_terratorch_config`, …

**Compat:** `test_api.py` (`/health`, `/model`, `/predict`).

---

## 11. Laboratorio y código heredado

### `lab/`

- **No** es importado como paquete por producción.
- Soft refs: settings `tune_data_dir`/`tune_configs_dir`, Dockerfile.cpu, `test_prepare_data.py`.
- **Clasificación:** **Académico**.
- **Decisión:** **conservar** en el árbol. Existe respaldo en `origin/backup/mlops-finetuning-lab`. No eliminar en esta rama para no perder contexto de grado; documentar como secundario (README ya lo indica).

### Stages / training / tracking / registry

- Fuera del path de inundación HTTP.
- **Clasificación:** **Académico**.
- **Decisión esta rama:** no borrar módulos; opcionalmente aclarar en docs y separar extra `inference`. Retirar código solo en un PR dedicado con checklist de tests CLI/lab.

### `/model` y `/predict`

- Legacy de laboratorio.
- **Decisión:** conservar por ahora (**Dudoso**); no confundir con `/api/analyze` / catálogo.

---

## 12. Higiene de repositorio

| Ítem | Hallazgo | Clasificación / acción |
|---|---|---|
| `web/tsconfig.tsbuildinfo` | Versionado (~artefacto TS) | **Obsoleto** en Git → untrack + `.gitignore` |
| `web/.gitignore` | Solo `node_modules`, `dist` | Ampliar |
| ADRs / `docs/decisions/` | Decisiones de arquitectura | **Académico** / **App** — **conservar** |
| Informes `docs/*Informe*.md` | Material de grado | **Académico** — **conservar** |

---

## 13. Matriz de decisión para esta rama

| Acción | ¿Se hace? | Motivo |
|---|---|---|
| Mapa interactivo + STAC | Sí | Requisito de producto |
| UX mensajes / estados | Sí | Sin rediseño total |
| Untrack `tsbuildinfo` | Sí | Bajo riesgo |
| Extra `inference` en pyproject | Sí | Claridad; no quitar deps de Prithvi |
| Eliminar `lab/` | **No** | Académico + conservadurismo |
| Eliminar stages/MLflow código | **No** en esta rama | Respaldo existe, pero impacto CLI/tests alto |
| Eliminar `/model` `/predict` | **No** | Actualizaría tests de compat; bajo valor ahora |
| Eliminar Burn Scars backend | **No** | Requisitos académicos / ejemplos |
| Marketplace / upload de modelos | **No** | Fuera de alcance |

---

## 14. Riesgos y límites del entorno

- Inferencia real Prithvi requiere GPU/CPU + ~1,2 GB de pesos + TerraTorch.
- STAC / Nominatim / JRC / GFM dependen de red externa.
- CI probablemente no valida GPU (`@pytest.mark.gpu`).

Las pruebas reales de inferencia y las limitaciones se documentarán en `implementation-report.md`.
