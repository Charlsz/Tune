# Tune — Arquitectura v1.2

**Versión:** 1.2  
**Fecha:** 2026-09-15  
**Basado en:** [Primer Informe](../PrimerInforme.md) — sección 5 · [Investigacion.md](../research/Investigacion.md)

## Visión general

Tune es un **laboratorio MLOps** (prototipo académico) para **fine-tuning eficiente**.  
Recibe dataset + modelo preentrenado + estrategia; ejecuta **baseline** y **optimized**; registra parámetros, tiempo, memoria y calidad; compara; promueve; sirve por **API o CLI**.

El modelo concreto (p. ej. Prithvi + Burn Scars) **valida** la arquitectura; no la define.

> La arquitectura permite ejecutar, registrar y comparar.  
> La estrategia (LoRA, FP16, …) explica el ahorro, **si existe**.

## Diagrama lógico

![Arquitectura](../assets/img/Arquitectura.jpg)

```text
Dataset versionado + modelo preentrenado
   ↓
Config (baseline | optimized)     ← configs/training/*.yaml
   ↓
Fine-tuning                       ← infrastructure/training
   ↓
Tracking (params, métricas, GPU)  ← infrastructure/tracking (MLflow)
   ↓
Evaluation (mismo test set)       ← infrastructure/evaluation
   ↓
Comparación                       ← application/stages/compare
   ↓
Registry / promoción              ← domain/policies + registry
   ↓
API / CLI de inferencia           ← interfaces/
```

## Arquitectura de código (clean architecture)

Dependencias hacia adentro: `interfaces → application → domain ← infrastructure`.

```text
src/tune/
├── domain/                 # entidades, policies, ports (sin torch/mlflow)
├── application/stages/     # prepare, train, evaluate, register, compare
├── infrastructure/         # YAML, data, Lightning, MLflow, evaluation, inference
│   └── container.py        # composición de dependencias
└── interfaces/
    ├── cli/                # `tune …`
    └── api/                # FastAPI /health /model /predict
```

Detalle operativo: [src/README.md](../../src/README.md) · [Desarrollo.md](../Desarrollo.md).

### Por qué esta forma

| Necesidad del proyecto | Cómo lo cubre |
|------------------------|---------------|
| Cambiar caso de estudio | Nuevo Evaluator + DataModule + YAML; domain/application intactos |
| Comparar dos estrategias | Solo difieren `precision` / `peft` en configs |
| Probar sin GPU | Domain + stages con fakes; CI sin torch de training |
| Evitar merge conflicts | Carpetas por rol (MLOps vs ML); ramas cortas por entrega |

## Componentes y estado real

| Componente | Tecnología | Ubicación | Estado |
|------------|------------|-----------|--------|
| Dataset | Scripts + metadata | `data/`, `infrastructure/data/` | `--init-layout` OK; corpus EO por poblar |
| Training | Lightning / PEFT | `infrastructure/training/` | **Stub** (`NotImplementedError`) |
| Estrategias | YAML | `configs/training/` | Borrador Burn Scars |
| Tracking | MLflow | `infrastructure/tracking/` | Parcial (`get_run` TODO) |
| Registry | MLflow Registry | `infrastructure/registry/` | Esqueleto |
| Evaluation | Métricas de tarea | `infrastructure/evaluation/` | **Stub** |
| Comparison | Deltas | `application/stages/compare.py` | Lógica lista; necesita runs reales |
| Pipeline | CLI `tune` | `interfaces/cli/` | Orquestación lista |
| API | FastAPI | `interfaces/api/` | `/health` `/model` OK; `/predict` stub |
| Domain | Umbrales / promoción | `domain/` | Implementado |
| Containers | Compose | `docker-compose.yml` | Esqueleto |
| CI | GitHub Actions | `.github/workflows/ci.yml` | Lint + tests + docker config |

## Caso de estudio (escalera)

1. **Preferido:** HLS Burn Scars + Prithvi-EO-2.0-300M (segmentación).  
2. **Pivot EO:** Sen1Floods11 + Prithvi (si fallan datos/tooling de Burn Scars; **no** arregla VRAM).  
3. **Plan B:** ResNet-50 + `beans`/CIFAR-10 (si VRAM insuficiente).

Ver [ADR 001](../decisions/001-task-selection.md) · [CaminoInmediato.md](../research/CaminoInmediato.md) · [ComoProbar.md](../research/ComoProbar.md).

## Entornos de ejecución

| Actividad | Dónde |
|-----------|--------|
| Código, tests, docs, API ligera | PC local (puede no tener NVIDIA) |
| Smoke / entrenamiento | Colab, Kaggle o GPU lab — **mismo hardware** para baseline y optimized |
| MLflow + API persistente | Docker Compose en máquina con disco |
| CI | Sin entrenar |

## Decisiones

- [ADR 001 — Caso de estudio](../decisions/001-task-selection.md)
- [ADR 002 — Orquestación](../decisions/002-orchestration.md)
- [ADR 003 — Protocolo experimental](../decisions/003-protocolo-experimental.md)
- [004 — Propuesta reunión tutor](../decisions/004-propuesta-tutor.md) (borrador)
- ADR 005 (tracking remoto Colab/Kaggle → MLflow): tras el primer smoke

## Evolución

| Versión | Cambios |
|---------|---------|
| v1.0 | Borrador Terra (ciclo Prithvi). Superado. |
| v1.1 | Tune: laboratorio desacoplado del caso |
| v1.2 | Rutas `src/tune/…`, estado real de stubs, compute, escalera de caso |
| v1.3 | (siguiente) Trainer + evaluate reales + tracking completo |
| v1.4 | API `/predict` + demo; segundo caso solo si el mínimo está cerrado |
