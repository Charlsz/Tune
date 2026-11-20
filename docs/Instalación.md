# Instalación y despliegue — Tune

Guía operativa para levantar, verificar y mantener el prototipo. Uso de la
interfaz: [GuiaDeUso.md](./GuiaDeUso.md). Arquitectura: [architecture/v2.md](./architecture/v2.md).

## 1. Descripción general de la solución

### 1.1 Lenguajes y tecnologías utilizadas

- **Backend:** Python 3.11, FastAPI, TerraTorch/PyTorch, rasterio, pystac-client
- **Frontend:** TypeScript, React 19, Vite, Leaflet
- **Orquestación:** Docker Compose (`eo-api` + `web`)
- **Calidad:** pytest, vitest, ruff

### 1.2 Componentes de la solución

| Componente | Rol | Puerto |
|---|---|---|
| `tune-web` | Nginx sirve MapApp y proxea `/api` | 8080 |
| `tune-eo-api` | FastAPI + inferencia Prithvi | 8000 |
| Volumen `hf-cache` | Pesos Hugging Face | — |
| `./artifacts` | Análisis y cachés del European Commission's Joint Research Centre (JRC) / Global Flood Monitoring (GFM) / exposición | — |

Diagrama: [assets/diagramas/despliegue.md](./assets/diagramas/despliegue.md).

## 2. Requisitos previos

### 2.1 Software requerido

- Git
- Docker Desktop con Compose (CPU basta; GPU opcional)
- En Windows: GNU Make (`winget install ezwinports.make`) y Git for Windows (el Makefile usa bash)

### 2.2 Variables de entorno

Copiar `.env.example` → `.env`. Relevantes:

| Variable | Uso |
|---|---|
| `API_PORT` / `WEB_PORT` | Puertos host (8000 / 8080) |
| `API_BIND` | En VM pública: `127.0.0.1` |
| `TUNE_OBSERVE_GFM` | `true` por defecto (SpatioTemporal Asset Catalog (STAC) del Earth Observation Data Centre (EODC)) |
| `TUNE_OBSERVE_OPERA` | `false`; Observational Products for End-Users from Remote Sensing Analysis (OPERA); requiere `EARTHDATA_TOKEN` |
| `TUNE_EXPOSURE` | WorldCover + Global Human Settlement Layer (GHSL) |
| `TUNE_CATALOG_MAX_KM` | Tope del lado del Area of Interest (AOI) |
| `VITE_MAPBOX_TOKEN` | Basemap Mapbox (build web); sin token usa OpenStreetMap (OSM) |

No commitear `.env` ni secretos.

## 3. Instalación para ambiente de desarrollo

### 3.1 Desarrollo sin contenedores

#### 3.1.1 Clonar el repositorio

```bash
git clone https://github.com/Charlsz/Tune.git
cd Tune
```

#### 3.1.2 Instalar dependencias

```bash
python -m venv .venv
# Windows: .\.venv\Scripts\activate
pip install -e ".[api,inference,dev]"
cd web && npm install && cd ..
```

#### 3.1.3 Configurar variables de entorno

```bash
cp .env.example .env
```

#### 3.1.4 Ejecutar servicios requeridos

API (desde la raíz, con el venv activo):

```bash
uvicorn tune.interfaces.api.main:app --reload --port 8000
```

#### 3.1.5 Iniciar la aplicación web

```bash
cd web
npm run dev
```

Abrir la URL que imprima Vite (típicamente http://localhost:5173). La API debe estar en :8000 (CORS según `.env`).

### 3.2 Desarrollo con contenedores

#### 3.2.1 Construcción de contenedores

```bash
cp .env.example .env
docker compose build
# o: make app-up  (build + up)
```

#### 3.2.2 Ejecución del entorno

```bash
docker compose up -d
# o: make app-up
make app-logs   # seguir primera descarga de pesos
```

#### 3.2.3 Servicios disponibles

- Web: http://localhost:8080  
- Application Programming Interface (API) / Swagger: http://localhost:8000/docs  

#### 3.2.4 Apagado del entorno

```bash
make app-down
# o: docker compose down
```

`down` conserva `hf-cache` y `artifacts/`.

### Si `make` no existe en PowerShell

```powershell
winget install ezwinports.make
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d --build
```

## 4. Despliegue (en caso de ser aplicable)

### 4.1 Arquitectura de despliegue

Misma Compose en una VM con Docker. Nginx publica :8080; API en :8000. Recomendación: `API_BIND=127.0.0.1` para que solo nginx sea público. Ver [despliegue](./assets/diagramas/despliegue.md).

### 4.2 Proceso de actualización

```bash
git pull
docker compose up -d --build
```

### 4.3 Despliegue sin contenedores

Viable con venv + `uvicorn` + `npm run build` y un servidor estático que proxee `/api`. No es el camino preferido del equipo; Compose unifica GDAL/torch.

### 4.4 Despliegue con contenedores

#### 4.4.1 Construcción de imágenes

`docker/eo/Dockerfile` (API + torch) y `web/Dockerfile` (build Vite + nginx).

#### 4.4.2 Ejecución en servidor

`docker compose up -d --build` desde la raíz con `.env` configurado.

#### 4.4.3 Variables de entorno y secretos

Solo en `.env` del servidor. `EARTHDATA_TOKEN` solo si se activa OPERA.

#### 4.4.4 Persistencia y redes

Volumen nombrado `hf-cache`; bind mount `./artifacts`. Red interna Compose entre `web` y `eo-api`.

#### 4.4.5 Actualización del despliegue

Rebuild de imágenes tras `git pull`; no borrará pesos ni análisis si se conservan volumen y carpeta.

## 5. Verificación de funcionamiento

1. `GET http://localhost:8000/health` (o equivalente) responde OK.  
2. Swagger lista `/api/tasks` con flood / Prithvi.  
3. MapApp carga el mapa; buscar Sindh, fechas 2022-05-18 / 2022-09-05, consultar escenas.  
4. Tras analizar: modo Cambio muestra overlay; Acuerdo solo si hay `fusion_png`.  
5. `pytest -m "not gpu"` y `cd web && npm test` en verde.

## 6. Solución de problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| Primera inferencia muy lenta | Descarga ~1,2 GB a `hf-cache`; ver `make app-logs` |
| Sin escenas en catálogo | Nubes, fechas, `side_km` vs `TUNE_CATALOG_MAX_KM`, red a Earth Search |
| Acuerdo GFM deshabilitado | Normal si EODC no tiene ítem ±10 d o STAC caído; análisis válido igual |
| Mapa sin satélite | Falta `VITE_MAPBOX_TOKEN` en build; cae a OSM (OpenStreetMap) |
| `make` no encontrado | `winget install ezwinports.make` o usar `docker compose` directo |
| Docker lento en Windows | Windows Subsystem for Linux 2 (WSL2) / HypervisorPlatform habilitados |

## 7. Mantenimiento y actualización

- No versionar `artifacts/`, pesos ni `.env`.  
- Tras cambios de API, rebuild `eo-api`; tras cambios de UI, rebuild `web`.  
- ADRs en `docs/decisions/`. Deuda conocida: SPA legacy no montada; historial MapApp solo de sesión.

## 8. Referencias relacionadas

- [GuiaDeUso.md](./GuiaDeUso.md)  
- [Desarrollo.md](./Desarrollo.md)  
- [InformeFinal.md](./InformeFinal.md)  
- [architecture/v2.md](./architecture/v2.md)  
- [validation/casos-demostracion.md](./validation/casos-demostracion.md)
