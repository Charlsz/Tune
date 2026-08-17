# Terra

Arquitectura MLOps para el ciclo de vida reproducible y despliegue de modelos geoespaciales basados en **Prithvi-EO-2.0**, desarrollada como proyecto de grado en Ingeniería de Sistemas y Computación.

## Problema

La adaptación de modelos fundacionales geoespaciales mediante fine-tuning requiere gestionar datasets, configuraciones, experimentos, métricas, versiones y despliegue. Herramientas como TerraTorch facilitan el entrenamiento, pero no integran por sí solas un ciclo de vida reproducible y trazable.

**Terra** conecta esas etapas bajo una arquitectura MLOps modular: preparación de datos → fine-tuning → evaluación → experiment tracking → model registry → despliegue → API REST.

## Stack

| Componente | Tecnología |
|------------|------------|
| Foundation model | [Prithvi-EO-2.0-300M-TL](https://huggingface.co/ibm-nasa-geospatial) |
| Fine-tuning | [TerraTorch](https://github.com/IBM/terratorch) |
| Experiment tracking | [MLflow](https://mlflow.org/) |
| API | FastAPI |
| Contenedores | Docker |

## Tarea principal

**Wildfire Scar Detection** (detección de cicatrices de incendio) sobre el dataset [HLS Burn Scars](https://huggingface.co/datasets/ibm-nasa-geospatial/hls_burn_scars), alineada con la solución propuesta en el [Primer Informe](./docs/PrimerInforme.md).

## Estado del proyecto

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 | Repo, arquitectura, config baseline | En progreso |
| 1 | Fine-tuning reproducible | Pendiente |
| 2 | MLflow + model registry | Pendiente |
| 3 | Pipeline automatizado | Pendiente |
| 4 | API + Docker | Pendiente |

Ver el [plan de trabajo completo](./docs/plan.md).

## Inicio rápido

### 1. Clonar e instalar

```bash
git clone <repo-url> terra
cd terra
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -e ".[dev]"
cp .env.example .env
```

### 2. Smoke test en Colab (recomendado para empezar)

Abrir el notebook oficial con GPU T4:

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/blumenstiel/TerraTorch-Examples/blob/main/prithvi_v2_eo_300_tl_unet_burnscars.ipynb)

### 3. Descargar dataset (cuando se entrene localmente)

```bash
pip install huggingface_hub
huggingface-cli download ibm-nasa-geospatial/hls_burn_scars --repo-type dataset --local-dir data/hls_burn_scars
python scripts/prepare_data.py
```

### 4. Entrenar (local, cuando el dataset esté listo)

```bash
terratorch fit --config configs/training/burn_scars.yaml
```

## Estructura del repositorio

```text
terra/
├── configs/          # YAML: entrenamiento, MLflow
├── data/             # Datasets locales (no versionados en Git)
├── docs/             # Informes, plan, arquitectura, ADRs
├── scripts/          # prepare_data, run_pipeline
├── src/terra/        # Código fuente modular
├── notebooks/        # Exploración
├── tests/
├── docker/
└── demo/
```

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [Primer Informe](./docs/PrimerInforme.md) | Planteamiento, objetivos, estado del arte |
| [Plan de trabajo](./docs/plan.md) | Fases, hitos y cronograma |
| [Arquitectura v1](./docs/architecture/v1.md) | Diagrama y componentes |
| [ADR 001 — Tarea](./docs/decisions/001-task-selection.md) | Burn Scars como tarea principal |
| [Segundo Informe](./docs/SegundoInforme.md) | Avances del semestre |
| [Instalación](./docs/Instalación.md) | Guía de instalación |
| [Desarrollo](./docs/Desarrollo.md) | Manual técnico |

## Equipo

| Nombre | GitHub |
|--------|--------|
| Carlos Andrés Galvis Pájaro | [@Charlsz](https://github.com/Charlsz) |
| Zenen Contreras Royero | [@zenencontreras](https://github.com/zenencontreras) |

**Tutor:** Daniel Romero

## Licencia

[MIT](./LICENSE)
