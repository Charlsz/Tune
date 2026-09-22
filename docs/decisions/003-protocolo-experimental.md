# ADR 003 — Protocolo experimental (decisiones de investigación)

**Estado:** Activo  
**Fecha:** 2026-09-15  

## Contexto

Tune necesita criterios fijos *antes* de la primera corrida comparable. Este ADR fija el protocolo de investigación por defecto. Se actualiza solo con evidencia (smoke fallido, OOM, tooling roto), no por espera externa.

## Decisiones

### 1. Pregunta

¿Una estrategia *optimized* reduce recursos (tiempo / memoria GPU / GPU-hours) frente a un *baseline* sin degradar de forma significativa la calidad, dejando la corrida trazable y el modelo servible?

### 2. Caso de estudio (escalera)

| Orden | Caso | Cuándo |
|-------|------|--------|
| 1 | HLS Burn Scars + Prithvi-EO-2.0-300M (segmentación) | Preferido |
| 2 | Sen1Floods11 + Prithvi | Solo si Burn Scars falla por datos/tooling (no por VRAM) |
| 3 | ResNet-50 + `beans` o CIFAR-10 (clasificación) | Si VRAM ≤ ~8 GB o smoke EO inviables |

### 3. Par de estrategias

| | Baseline | Optimized |
|---|----------|-----------|
| Precisión | FP32 | FP16 mixed |
| PEFT | ninguno (full FT) | LoRA r=8, alpha=16 |
| Fijo | mismo dataset, modelo, seed 42, epochs/batch/lr del YAML | |

Configs: `lab/configs/training/baseline.yaml`, `optimized.yaml`.

### 4. Métricas

| Tipo | Valor por defecto |
|------|-------------------|
| Calidad (segmentación) | **mIoU** primaria; IoU / F1 secundarias |
| Calidad (Plan B) | **accuracy** primaria; macro-F1 secundaria |
| Eficiencia (siempre) | wall time, peak GPU memory, GPU-hours o proxy |
| Umbral piso | `min_primary_metric: 0.60` |
| Caída máx. vs baseline | `max_quality_drop_vs_baseline: 0.02` |

Archivo: `lab/configs/pipeline/thresholds.yaml`.

### 5. Hardware

| Rol | Entorno |
|-----|---------|
| Desarrollo (código, tests, API, MLflow UI) | Máquina local; puede no tener NVIDIA |
| Smoke y corridas experimentales | **Kaggle** (cuota predecible) o **Colab** (T4 cuando hay cupo) |
| Referencia del par baseline vs optimized | El mismo host GPU documentado en el run (lab *o* free-tier). No mezclar hardware entre las dos estrategias. |

Prithvi-300M: objetivo cómodo ~16 GB (T4). Si el smoke OOM tras bajar batch → Plan B.

### 6. Tracking remoto

Hasta tener ADR 004 detallado: loggear en el entorno de train y, si hace falta, exportar/importar runs a un MLflow local (`docker compose up mlflow`). Preferir un solo `MLFLOW_TRACKING_URI` alcanzable desde el job de train.

## Consecuencias

- El equipo avanza sin bloquearse: estos valores son la línea base de investigación.
- Cualquier cambio de métrica, umbral o caso se refleja aquí + ADR 001 + YAMLs en el mismo PR.
- “No hubo ahorro” es resultado publicable si el protocolo se respetó.

## Referencias

- [ADR 001](./001-task-selection.md) · [Investigacion.md](../../lab/docs/research/Investigacion.md) · [CaminoInmediato.md](../../lab/docs/research/CaminoInmediato.md)
