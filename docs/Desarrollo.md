# Manual de desarrollo — Tune

Guía para mantener la **aplicación** de análisis satelital (GeoTIFF → máscara Prithvi → mapa).

**No editar** `docs/PrimerInforme.md` (entrega fija 2026-08-29). El eje vigente es [ADR 005](./decisions/005-app-inferencia-checkpoints-publicados.md). El laboratorio de fine-tuning vive en [`lab/`](../lab/README.md).

## 1. Stack

- **Backend:** Python ≥ 3.10, FastAPI, Typer, TerraTorch/PyTorch (inferencia)
- **Web:** Vite, React, TypeScript, Leaflet
- **Contenedores:** Docker Compose (`eo-api` + `web`)
- **Calidad:** pytest, ruff, GitHub Actions

## 2. Estructura del repositorio

```text
Tune/
├── web/                 # UI
├── src/tune/            # dominio, inferencia, API, CLI
├── tests/
├── docker/eo/           # imagen PyTorch + TerraTorch
├── docker-compose.yml   # solo la app
├── docs/                # informes y ADRs
├── examples/            # cómo obtener GeoTIFF de prueba
└── lab/                 # fine-tuning (secundario)
```

Código Python: [src/README.md](../src/README.md). Dependencias hacia adentro: `interfaces → application → domain ← infrastructure`.

1. `domain/` no importa torch, fastapi ni rasterio.
2. TerraTorch y rasterio se importan tarde (la API arranca sin GPU).
3. Un solo `container.py` cablea implementaciones.

## 3. Flujo

1. Rama `feat/…` desde `main`.
2. `ruff check .` + `pytest` en local.
3. PR a `main`; CI (quality + web + `docker compose config`).
4. No commitear `.env`, datos, pesos ni `artifacts/`.

```bash
pip install -e ".[api,dev]"     # día a día sin torch
make test
make web-dev                    # UI caliente; API en :8000
```

| Quiero… | Dónde |
|---------|--------|
| Caso de uso de análisis | `application/analyze.py` |
| Checkpoint / bandas | `infrastructure/inference/prithvi.py` |
| Persistencia de máscaras | `infrastructure/analyses/` |
| Endpoint | `interfaces/api/analyses.py` |
| Mapa / carga | `web/src/` |
| Fine-tuning | `lab/` + `application/stages/` |

## 4. Referencias

- [Instalación.md](./Instalación.md)
- [architecture/v2.md](./architecture/v2.md)
- [lab/docs/architecture-v1.md](../lab/docs/architecture-v1.md) (diseño del laboratorio)
- [lab/docs/research/ComoProbar.md](../lab/docs/research/ComoProbar.md)
