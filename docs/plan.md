# Tune — Plan de trabajo

**Proyecto:** Arquitectura MLOps para el fine-tuning eficiente de modelos avanzados de IA  
**Versión:** 1.1  
**Referencia académica:** [Primer Informe](./PrimerInforme.md)

---

## 1. Objetivo del plan

Este documento operacionaliza la metodología y los objetivos del primer informe. Traduce las **7 iteraciones** (sección 7.2) en tareas, entregables e hitos.

**Principio rector:** primero un baseline reproducible y comparable; después la estrategia optimizada; al cierre, el modelo servible. La interfaz es opcional.

El plan se organiza por **fases e hitos**, no por un calendario rígido. Las fechas se ajustan según GPU y retroalimentación del tutor.

---

## 2. Alineación con el primer informe

| Elemento del informe | Decisión en Tune |
|---------------------|-------------------|
| Objetivo general (sección 4.1) | Laboratorio MLOps que compara baseline vs optimizado y sirve el modelo |
| Modelo + dataset | Un modelo preentrenado + un dataset; el caso es intercambiable |
| Estrategias | Baseline (full FT o referencia) y optimized (p. ej. LoRA / FP16) |
| MLflow (tracking + registry) | `configs/mlflow/`, módulo `src/mlops/` |
| Comparación | Tiempo, memoria GPU, GPU-hours, calidad sobre el mismo test set |
| API REST o CLI | FastAPI en `src/api/`: `/health`, `/model`, `/predict` |
| Validación | Funcional, reproducibilidad, eficiencia, calidad, cierre de ciclo |
| Alcance académico / prototipo | Sin Kubernetes, multi-cloud ni producción enterprise |

---

## 3. Reglas del proyecto

1. Cerrar el mínimo experimental (1 modelo + 1 dataset + 2 estrategias) antes de un segundo caso.
2. El caso de estudio se puede sustituir si el primero bloquea; Tune no se redefine.
3. Un commit por cambio significativo (convención: `feat`, `docs`, `test`, `fix`, `refactor`, `chore`, `ci`, `experiment`).
4. No commitear datasets, pesos, `.env` ni artefactos grandes.
5. Notebooks para exploración; lógica reutilizable en `src/`.
6. No atribuir a la arquitectura un ahorro que produzca LoRA, FP16 u otra técnica.
7. **Prioridad si falta tiempo o GPU:** (1) baseline reproducible → (2) tracking y registry → (3) optimized + comparación → (4) API/CLI → (5) demo mínima.

---

## 4. Fases e iteraciones

Las fases corresponden a las iteraciones del primer informe (sección 7.2).

### Fase 0 — Arquitectura y acuerdos experimentales

**Iteración 1:** diseño Tune y criterios de comparación.

| ID | Tarea | Entregable | Estado |
|----|-------|------------|--------|
| 0.1 | Estructura del repositorio | Carpetas, `pyproject.toml`, `.gitignore` | Hecho |
| 0.2 | README como punto de entrada | `README.md` | Hecho |
| 0.3 | ADR de caso de estudio | `docs/decisions/001-task-selection.md` | Actualizado |
| 0.4 | Arquitectura v1 Tune | `docs/architecture/v1.md` | Actualizado |
| 0.5 | Acordar métricas de eficiencia y umbral de calidad | Nota con el tutor | Pendiente |
| 0.6 | Fijar modelo preentrenado, dataset y plan B | ADR 001 | Pendiente |
| 0.7 | Configs baseline y optimized | `configs/training/` | Pendiente |

**Hito:** arquitectura Tune + criterios baseline / optimizado + caso (y respaldo) documentados.

---

### Fase 1 — Datos y baseline reproducible

**Iteración 2:** primera corrida de referencia.

| ID | Tarea | Entregable |
|----|-------|------------|
| 1.1 | Preparar y versionar el dataset | `data/` (local, no en Git) + metadatos |
| 1.2 | Notebook o script de exploración | `notebooks/` o `scripts/prepare_data.py` |
| 1.3 | Fine-tuning baseline | Métricas de referencia |
| 1.4 | Registrar parámetros y métricas | Run trazable |
| 1.5 | Documentar hardware y config | Insumo del informe |

**Hito:** dataset versionado + corrida baseline reproducible.

---

### Fase 2 — Experiment tracking y Model Registry

**Iteración 3:** trazabilidad dataset ↔ corrida ↔ modelo.

| ID | Tarea | Entregable |
|----|-------|------------|
| 2.1 | Configurar MLflow local | UI accesible en `./mlruns` |
| 2.2 | Log de params, métricas, artefactos y recursos | Integración en entrenamiento |
| 2.3 | Model Registry | Versiones + metadatos |
| 2.4 | Flujo de promoción: `trained → evaluated → candidate → approved` | Implementación |

**Hito:** experimentos recuperables y modelos versionados.

---

### Fase 3 — Estrategia optimizada y comparación

**Iteración 4:** evidencia central del proyecto.

| ID | Tarea | Entregable |
|----|-------|------------|
| 3.1 | Implementar estrategia optimized | Config + código PEFT / FP16 / etc. |
| 3.2 | Instrumentar tiempo, memoria, GPU-hours | Métricas de eficiencia |
| 3.3 | Segunda corrida, mismas condiciones | Run comparable |
| 3.4 | Tabla o gráfico + interpretación | Incluye el caso “no ahorró” si aplica |

**Hito:** par experimental baseline versus optimizado.

---

### Fase 4 — Evaluación, promoción y pipeline

**Iteración 5:** flujo automático.

| ID | Tarea | Entregable |
|----|-------|------------|
| 4.1 | Stages del pipeline | `prepare → train → evaluate → register → compare` |
| 4.2 | `scripts/run_pipeline.py` | Pipeline end-to-end |
| 4.3 | Thresholds de promoción y rechazo | Criterios explícitos |
| 4.4 | CI: lint + tests (sin entrenar en cada push) | `.github/workflows/ci.yml` |

**Hito:**

```text
Training → Evaluation → Threshold → PASS → Registry → Compare
                              └── FAIL → Reject
```

Ver [ADR 002](./decisions/002-orchestration.md).

---

### Fase 5 — Inferencia y demo

**Iteración 6:** cierre experimento → uso.

| ID | Tarea | Entregable |
|----|-------|------------|
| 5.1 | Módulo de inferencia | `src/inference/` |
| 5.2 | API FastAPI: `/health`, `/model`, `/predict` | `src/api/` |
| 5.3 | Versión del modelo en la respuesta | Schema documentado |
| 5.4 | Dockerfile de inferencia (si aporta) | `docker/` |
| 5.5 | Demo de comparación + predicción | `demo/` o CLI; UI solo si no come experimentos |

**Hito:** modelo servible + demo de “¿menos recursos, casi la misma calidad?”.

---

### Fase 6 — Validación y cierre

**Iteración 7:** evidencia y documentación final.

| ID | Tarea | Entregable |
|----|-------|------------|
| 6.1 | Repetir al menos una corrida | Evidencia de reproducibilidad |
| 6.2 | Checklist funcional (pipeline, registry, API) | Validación |
| 6.3 | Segundo caso de estudio | Solo si el mínimo ya está cerrado |
| 6.4 | Informe Final + Instalación + Desarrollo | `docs/` |
| 6.5 | README final | Punto de entrada completo |

**Hito:** resultados, limitaciones e informe de cierre.

---

## 5. Hitos (sin calendario rígido)

| Fase | Entregable principal |
|------|----------------------|
| 0. Arquitectura y acuerdos | Criterios + caso de estudio |
| 1. Datos y baseline | Corrida baseline reproducible |
| 2. Tracking y registry | Experimentos trazables |
| 3. Optimizado y comparación | Tabla baseline versus optimizado |
| 4. Pipeline | Flujo extremo a extremo |
| 5. API y demo | Modelo servible |
| 6. Validación y docs | Informe de cierre |

---

## 6. Definition of Done

- [ ] README explica propósito Tune, arquitectura, setup y uso
- [ ] Dataset versionado con pasos documentados
- [ ] Configs baseline y optimized ejecutables
- [ ] Dos corridas trackeadas y comparables (MLflow)
- [ ] Tabla de tiempo, memoria/GPU-hours y calidad
- [ ] Modelo registrado con promoción documentada
- [ ] Pipeline `prepare → train → evaluate → register → compare`
- [ ] Inferencia vía API o CLI con versión de modelo
- [ ] Al menos un run repetido
- [ ] Informe Final describe lo implementado y sus limitaciones

---

## 7. División de roles sugerida

| Carlos (Infra / MLOps) | Zenen (ML / Datos) |
|------------------------|---------------------|
| Repo, CI, Docker | Fine-tuning, métricas de tarea |
| MLflow, pipeline, API | Dataset, notebooks, instrumentación GPU |
| Docs técnicas | Informes y análisis baseline vs optimized |

Revisión conjunta: ¿el baseline corre? ¿la comparación es defendible? ¿qué bloquea?

---

## 8. Referencias

- [Primer Informe](./PrimerInforme.md)
- [Arquitectura v1](./architecture/v1.md)
- [ADR 001 — Caso de estudio](./decisions/001-task-selection.md)
- [ADR 002 — Orquestación](./decisions/002-orchestration.md)
