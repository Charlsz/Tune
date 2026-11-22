# Manual de desarrollo — Tune

## 1. Propósito del documento

Guía técnica para comprender, mantener y extender Tune. Dirigida a quien deba
familiarizarse con la estructura del repositorio, contenedores, scripts,
variables de entorno y flujo de trabajo.

**No editar** `docs/PrimerInforme.md` (entrega fija). Eje vigente: [ADR 005](./decisions/005-app-inferencia-checkpoints-publicados.md). El laboratorio de fine-tuning está en [`lab/`](../lab/README.md).

## 2. Descripción general del proyecto desde la perspectiva de desarrollo

Tune es una aplicación cliente-servidor de análisis de inundación: GeoTIFF o
escena Sentinel-2 → máscara Prithvi → agua nueva (European Commission's Joint Research Centre (JRC) / historial) → fusión Global Flood Monitoring (GFM)
opcional → exposición → MapApp.

### 2.1 Tecnologías principales

- **Frontend:** TypeScript, React 19, Vite, Leaflet, Mapbox
- **Backend:** Python ≥ 3.10, FastAPI, Typer, TerraTorch/PyTorch, rasterio
- **Persistencia:** sistema de archivos (`artifacts/`), sin PostgreSQL
- **Contenedores:** Docker Compose (`eo-api`, `web`)
- **Calidad:** pytest, vitest, ruff, GitHub Actions

### 2.2 Componentes principales

- **MapApp:** User Interface (UI) de producción (`web/src/main.tsx`)
- **eo-api:** contrato `/api` (Application Programming Interface) y `AnalyzeUseCase`
- **Proveedores:** Prithvi, JRC/historial, GFM, WorldCover / Global Human Settlement Layer (GHSL), Earth Search
- **Lab (anexo):** pipeline de fine-tuning / MLflow, fuera del flujo Hypertext Transfer Protocol (HTTP) de inundación

## 3. Estructura del repositorio

### 3.1 Árbol general

```text
Tune/
├── web/                 # MapApp (Vite + React + Leaflet)
├── src/tune/            # dominio, aplicación, infraestructura, API, CLI
├── tests/               # unit + integration
├── docker/eo/           # imagen PyTorch + TerraTorch
├── docker-compose.yml
├── docs/                # informes, ADRs, validación, diagramas
├── examples/
├── artifacts/           # runtime (no versionar resultados)
└── lab/                 # fine-tuning (secundario)
```

### 3.2 Directorios relevantes

| Ruta | Propósito |
|---|---|
| `src/tune/domain/` | Entidades y puertos EO (sin torch) |
| `src/tune/application/` | `analyze`, `change`, `fusion`, `exposure` |
| `src/tune/infrastructure/` | Prithvi, STAC, JRC, GFM, filesystem, `container.py` |
| `src/tune/interfaces/api/` | FastAPI |
| `web/src/MapApp.tsx` | UI producción |
| `docs/assets/diagramas/` | Mermaid de arquitectura / secuencias / despliegue (fuente del informe) |
| `docs/decisions/` | Architecture Decision Records (ADRs) |

Código Python: [src/README.md](../src/README.md). Dependencias: `interfaces → application → domain ← infrastructure`.

## 4. Organización de la solución a nivel de código

### 4.1 Organización por capas

Arquitectura hexagonal. El dominio no importa torch, fastapi ni rasterio.
TerraTorch y rasterio se importan tarde. Un `container.py` cablea adaptadores.

### 4.2 Relación componentes ↔ código

| Quiero… | Dónde |
|---|---|
| Caso de uso de análisis | `application/analyze.py` |
| Checkpoint / bandas | `infrastructure/inference/prithvi.py` |
| Observación GFM (Global Flood Monitoring) | `infrastructure/observation/stac.py`, `application/fusion.py` |
| Persistencia | `infrastructure/analyses/` |
| Endpoint | `interfaces/api/analyses.py` |
| UI producción | `main.tsx` → `MapApp.tsx` |
| Bridge API ↔ UI | `data/tuneProvider.ts`, `data/apiBridge.ts` |
| Estado MapApp | `domain/lab.ts` (nombre histórico; no es `lab/` MLOps) |
| Fine-tuning | `lab/` + `application/stages/` |

## 5. Contenedores

### 5.1 Contenedores utilizados

- `tune-eo-api`: inferencia + API  
- `tune-web`: build estático + nginx (proxy `/api`)

### 5.2 Archivos relacionados

- `docker-compose.yml`, `docker-compose.gpu.yml` (opcional)
- `docker/eo/Dockerfile`, `web/Dockerfile`

### 5.3 Construcción y ejecución

```bash
docker compose up -d --build
docker compose logs -f eo-api
docker compose down
```

### 5.4 Redes, puertos y volúmenes

Web :8080, API :8000. Volumen `hf-cache`. Bind `./artifacts`. Red Compose interna.

### 5.5 Recomendaciones al modificar contenedores

No borrar el volumen de pesos sin necesidad. Mantener el proxy `/api` en nginx.
Cambios de deps torch → rebuild completo de `eo-api` (lento la primera vez).

## 6. Scripts y automatizaciones

### 6.1 Scripts principales

| Comando | Efecto |
|---|---|
| `make app-up` / `app-down` / `app-logs` | Compose app |
| `make test` | pytest |
| `make web-dev` | Vite hot reload |
| `npm test` (en `web/`) | vitest |
| `pip install -e ".[api,inference,dev]"` | deps locales |

### 6.2 Scripts auxiliares

`scripts/`, ejemplos en `examples/`. Diagramas del curso en `docs/assets/diagramas/`.

### 6.3 Consideraciones

La primera inferencia necesita red a Hugging Face. Pruebas marcadas `gpu` o con red real no corren en CI por defecto.

## 7. Variables de entorno

### 7.1 Variables requeridas / relevantes

Ver `.env.example`: `TUNE_ARTIFACTS_DIR`, `TUNE_OBSERVE_GFM`, `TUNE_EXPOSURE`,
`TUNE_CATALOG_MAX_KM`, puertos, `VITE_MAPBOX_TOKEN`.

### 7.2 Por ambiente

Local Compose vs venv+Vite. Producción académica = misma Compose en VM con
`API_BIND` restringido.

### 7.3 Archivos de configuración

`.env` (local), `.env.example` (plantilla). No hay `.env.production` separado.

### 7.4 Secretos

`EARTHDATA_TOKEN`, `HF_TOKEN`, Mapbox: solo en entorno local/servidor, nunca en git.

## 8. Flujo de trabajo de desarrollo

### 8.1 Preparación

Clonar → `.env` → `pip install -e ".[api,dev]"` y/o `make app-up` → `npm install` en `web/`.

### 8.2 Nuevas funcionalidades

Rama `feat/…` desde la rama de trabajo. Cambios de dominio con puerto + prueba.
UI MapApp vía `apiBridge` / métricas / overlays.

### 8.3 Pruebas y validaciones

```bash
ruff check .
pytest -m "not gpu"
cd web && npm test && npm run build
```

### 8.4 Integración

PR a la rama principal del equipo; CI (quality + web + `docker compose config`).
No forzar push a `main` sin acuerdo.

## 9. Dependencias y servicios externos

### 9.1 Servicios externos

Hugging Face, Earth Search, Global Surface Water (GSW) del JRC, Earth Observation Data Centre (EODC) / GFM, WorldCover, GHSL; Mapbox (tiles);
Observational Products for End-Users from Remote Sensing Analysis (OPERA) opcional.

### 9.2 Requisitos de acceso

Cuenta HF solo si el rate limit lo exige. Earthdata token solo para OPERA.
Mapbox token para basemap satelital.

### 9.3 Desarrollo y pruebas

Mocks de `_search` / segmentador en unitarias. Corridas reales: pesos cacheados + red.

## 10. Convenciones del proyecto

### 10.1 Código

Python tipado; dominio limpio de IO pesado. Frontend: TypeScript estricto; entry solo MapApp.

### 10.2 Repositorio

Mensajes de commit claros; no versionar `artifacts/`, pesos, `.env`.

### 10.3 Documentación

Informes en `docs/`. Decisiones en ADRs. Diagramas Mermaid en `docs/assets/diagramas/`.

## 11. Problemas frecuentes y recomendaciones

### 11.1 Problemas frecuentes

Puertos ocupados; WSL/Docker en Windows; primera descarga HF; EODC 502 → `fusion: null`.

### 11.2 Deuda técnica conocida

- Historial MapApp ≠ `GET /api/analyses`.  
- `domain/lab.ts` nombre confuso respecto a `lab/`.  
- Informe de usabilidad interno (equipo), no estudio externo.

### 11.3 Continuidad

Priorizar cablear historial API en la UI. Mantener ADR 010 (inundación = agua nueva).

## 12. Historial de decisiones técnicas relevantes

Ver `docs/decisions/`: ADR 005 (checkpoints publicados), 010 (cambio), 014 (GFM),
015 (exposición), 016 (validación global). Pivot desde laboratorio de fine-tuning
hacia app de análisis documentado en el segundo informe.

## 13. Referencias relacionadas

- [Instalación.md](./Instalación.md)  
- [architecture/v2.md](./architecture/v2.md)  
- [InformeFinal.md](./InformeFinal.md)  
- [GuiaDeUso.md](./GuiaDeUso.md)  
- [lab/docs/architecture-v1.md](../lab/docs/architecture-v1.md)
