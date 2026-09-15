# Manual de desarrollo — Tune

## 1. Propósito

Guía para mantener y extender el laboratorio Tune: fine-tuning eficiente (baseline vs optimized), tracking, registry e inferencia.

**No editar** `docs/PrimerInforme.md` (entrega fija 2026-08-29). Cambios de protocolo van en ADRs e `research/Investigacion.md`.

## 2. Descripción técnica

Tune es un **paquete Python** (`tune`) con clean architecture, CLI Typer, API FastAPI, MLflow y Docker Compose. No es un frontend; el “producto” es el pipeline medible + modelo servible.

### 2.1 Tecnologías

- **Lenguaje:** Python ≥ 3.10 (training tipado a 3.11 por torch)
- **Dominio / CLI:** Pydantic, Typer, PyYAML
- **API:** FastAPI, Uvicorn
- **Training (extra):** PyTorch, Lightning, PEFT, Transformers
- **Tracking:** MLflow
- **Contenedores:** Docker Compose
- **Calidad:** pytest, ruff, GitHub Actions

### 2.2 Componentes

| Componente | Función |
|------------|---------|
| `domain/` | Entidades, umbrales de promoción, puertos |
| `application/stages/` | Casos de uso del pipeline |
| `infrastructure/` | Adaptadores (YAML, FS, Lightning, MLflow, eval, inference) |
| `interfaces/cli` | Comando `tune` |
| `interfaces/api` | `/health`, `/model`, `/predict` |
| `configs/` | baseline, optimized, thresholds |
| `scripts/` | `prepare_data.py`, `run_pipeline.py` |

## 3. Estructura del repositorio

```text
Tune/
├── configs/           # YAML de entrenamiento y umbrales
├── data/              # datasets fuera de Git (solo README)
├── demo/              # demo mínima (opcional)
├── docker/            # Dockerfiles api / training
├── docs/              # informes, arquitectura, investigación, ADRs
├── notebooks/         # exploración (no lógica de producción)
├── scripts/           # utilidades de datos y pipeline
├── src/tune/          # código del laboratorio
├── tests/             # unit + integración API (sin GPU)
├── docker-compose.yml
├── pyproject.toml
└── README.md
```

## 4. Organización del código

Dependencias: `interfaces → application → domain ← infrastructure`.

Reglas:

1. `domain/` no importa torch, mlflow, fastapi ni yaml.
2. Los stages reciben puertos por constructor (testeables con fakes).
3. Imports pesados lazy (CLI/API/tests sin GPU).
4. Cambiar de caso = Evaluator + DataModule + configs; no reescribir domain.
5. Un solo `container.py` conoce el cableado concreto.

Ver [src/README.md](../src/README.md).

## 5. Flujo de desarrollo

1. Rama `feat/…` desde `main` (autor único; no tocar ramas ajenas).
2. Implementar en la carpeta de tu rol (MLOps vs ML).
3. `ruff check .` + `pytest` en local.
4. PR a `main`; CI debe pasar (quality + docker).
5. No commitear `.env`, datos, pesos ni `mlruns/`.

### 5.1 Comandos útiles

```bash
pip install -e ".[api,dev]"          # día a día sin torch
pip install -e ".[training,tracking]" # solo en entorno GPU / contenedor training
pytest -q
ruff check .
tune --help
```

### 5.2 Dónde implementar lo que falta

| Quiero… | Archivo / carpeta |
|---------|-------------------|
| Descargar dataset | `scripts/prepare_data.py` |
| Entrenar de verdad | `infrastructure/training/lightning_trainer.py` |
| Métricas de tarea | `infrastructure/evaluation/` |
| Recuperar run MLflow | `infrastructure/tracking/mlflow_tracker.py` → `get_run` |
| Inferencia | `infrastructure/inference/` |
| Umbrales | `configs/pipeline/thresholds.yaml` + `domain/policies.py` |

## 6. Contenedores

Ver [docker/README.md](../docker/README.md).

```bash
cp .env.example .env
docker compose up -d mlflow api
docker compose --profile training run --rm training tune --help
```

GPU NVIDIA + Container Toolkit en el host de entrenamiento. En PC sin NVIDIA: solo `mlflow` + `api`.

## 7. Variables de entorno

Copiar `.env.example` → `.env`. Claves: `MLFLOW_TRACKING_URI`, `TUNE_DATA_DIR`, `TUNE_CONFIGS_DIR`, `TUNE_ARTIFACTS_DIR`, `TUNE_MODEL_NAME`, `TUNE_MODEL_ALIAS`.

## 8. Pruebas

- Unitarias: policies, configs, stages con fakes.
- Integración: API sin registry / predict stub.
- Marcador `gpu`: reservado; CI corre `not gpu`.

## 9. Extensión y mantenimiento

- **Nuevo caso de estudio:** ADR 001 + configs + evaluator + datamodule.
- **Nueva técnica optimized:** solo YAML (+ soporte en trainer).
- **Cambiar tracker:** nuevo adaptador detrás de `ExperimentTracker` / `ModelRegistry`.
- **No** añadir orquestadores enterprise hasta tener baseline trackeado.

## 10. Documentos relacionados

- [Arquitectura v1.2](./architecture/v1.md)
- [Investigación](./research/Investigacion.md)
- [Camino inmediato](./research/CaminoInmediato.md)
- [Cómo probar](./research/ComoProbar.md)
- [Plan](./research/plan.md)
- [Instalación](./Instalación.md)
