# Terra — Plan de trabajo

**Proyecto:** Arquitectura MLOps para el ciclo de vida y despliegue de modelos geoespaciales basados en Prithvi  
**Versión:** 1.0  
**Referencia académica:** [Primer Informe](./PrimerInforme.md)

---

## 1. Objetivo del plan

Este documento operacionaliza la metodología y los objetivos definidos en el primer informe. Traduce las **6 iteraciones de desarrollo** (sección 7.2) y el **cronograma de 12 semanas** (sección 7.4) en tareas concretas con entregables, hitos y reglas de prioridad.

**Principio rector:** demostrar el ML primero, construir el sistema MLOps después.

---

## 2. Alineación con el primer informe

| Elemento del informe | Decisión en Terra |
|---------------------|-------------------|
| Objetivo general (sección 4.1) | Arquitectura MLOps reproducible para Prithvi |
| Prithvi-EO-2.0 + TerraTorch | Modelo 300M-TL, configs en `configs/training/` |
| MLflow (tracking + registry) | `configs/mlflow/`, módulo `src/mlops/` |
| API REST | FastAPI en `src/api/` |
| Tareas: Flood + Burn Scars (sección 5) | **Burn Scars principal**, Flood opcional |
| Métricas de segmentación (sección 7.3) | IoU, mIoU, F1, precision, recall |
| Validación: funcional, reproducibilidad, desempeño, extensibilidad | Fase 7 de este plan |
| Alcance académico / prototipo | Sin Kubernetes, multi-cloud ni producción enterprise |

---

## 3. Reglas del proyecto

1. Una tarea principal bien implementada antes de una segunda.
2. Reutilizar notebooks y configs oficiales de NASA/IBM.
3. Un commit por cambio significativo (convención: `feat`, `docs`, `test`, `fix`, `refactor`, `chore`, `ci`, `experiment`).
4. No commitear datasets, pesos, `.env` ni artefactos grandes.
5. Notebooks para exploración; lógica reutilizable en `src/`.
6. **Prioridad si falta tiempo:** (1) experimento Prithvi → (2) reproducibilidad → (3) MLflow → (4) pipeline → (5) API → (6) evaluación → (7) demo.

---

## 4. Fases e iteraciones

Las fases corresponden a las iteraciones del primer informe (sección 7.2).

### Fase 0 — Análisis y definición (Semana 1)

**Iteración 1 del informe:** requerimientos, arquitectura, selección tecnológica.

| ID | Tarea | Entregable | Estado |
|----|-------|------------|--------|
| 0.1 | Estructura del repositorio | Carpetas, `pyproject.toml`, `.gitignore` | Hecho |
| 0.2 | README como punto de entrada | `README.md` | Hecho |
| 0.3 | ADR selección de tarea | `docs/decisions/001-task-selection.md` | Hecho |
| 0.4 | Arquitectura v1 | `docs/architecture/v1.md` | Hecho |
| 0.5 | Config baseline Burn Scars | `configs/training/burn_scars.yaml` | Hecho |
| 0.6 | Smoke test en Colab | Notebook ejecutado, resultados anotados | Pendiente |
| 0.7 | Cuentas: Hugging Face, Colab, Kaggle | Acceso verificado | Pendiente |

**Hito:** repositorio inicializado + smoke test de fine-tuning en Colab.

**Colab de referencia:**  
https://colab.research.google.com/github/blumenstiel/TerraTorch-Examples/blob/main/prithvi_v2_eo_300_tl_unet_burnscars.ipynb

---

### Fase 1 — Datos y fine-tuning (Semanas 2–3)

**Iteración 2 del informe:** preparación de datos, TerraTorch, fine-tuning reproducible.

| ID | Tarea | Entregable |
|----|-------|------------|
| 1.1 | Descargar dataset HLS Burn Scars | `data/hls_burn_scars/` (local, no en Git) |
| 1.2 | Notebook exploración del dataset | `notebooks/01_dataset_exploration.ipynb` |
| 1.3 | Script preparación de datos | `scripts/prepare_data.py` |
| 1.4 | Fine-tuning completo (Colab o local) | Métricas baseline |
| 1.5 | Repetir experimento (misma config + seed) | Evidencia reproducibilidad |
| 1.6 | Documentar metodología y resultados | Sección para Segundo Informe |

**Hito:** primer modelo fine-tuned + pipeline de entrenamiento reproducible + métricas iniciales.

**Métricas objetivo:** IoU, mIoU, F1 (segmentación).

---

### Fase 2 — Experiment tracking y Model Registry (Semanas 4–5)

**Iteración 3 del informe:** MLflow, trazabilidad, versionamiento.

| ID | Tarea | Entregable |
|----|-------|------------|
| 2.1 | Configurar MLflow local | UI accesible en `./mlruns` |
| 2.2 | Log automático de params, métricas, artefactos | Integración en entrenamiento |
| 2.3 | Registrar checkpoints | Artefactos versionados |
| 2.4 | Model Registry | Versiones + metadatos |
| 2.5 | Flujo de promoción: `trained → evaluated → candidate → approved` | ADR + implementación |
| 2.6 | 2–3 experimentos comparables | Tabla comparativa en MLflow |

**Hito:** experimentos trazables, modelos versionados, relación dataset ↔ experimento ↔ modelo.

---

### Fase 3 — Evaluación y automatización (Semana 6)

**Iteración 4 del informe:** evaluación automática, thresholds, promoción.

| ID | Tarea | Entregable |
|----|-------|------------|
| 3.1 | Definir stages del pipeline | `prepare → train → evaluate → register` |
| 3.2 | Implementar `scripts/run_pipeline.py` | Pipeline end-to-end |
| 3.3 | Validación de configs y errores | Manejo de fallos por stage |
| 3.4 | CI: lint + tests (sin entrenar en cada push) | `.github/workflows/ci.yml` |
| 3.5 | Ejecutar desde entorno limpio | Evidencia reproducibilidad |

**Hito:**

```text
Training → Evaluation → Threshold → PASS → Registry
                              └── FAIL → Reject
```

Ver [ADR 002](./decisions/002-orchestration.md).

---

### Fase 4 — Deployment y API (Semanas 7–8)

**Iteración 5 del informe:** empaquetado, inferencia, API REST, contenedores.

| ID | Tarea | Entregable |
|----|-------|------------|
| 4.1 | Módulo de inferencia | `src/inference/` |
| 4.2 | API FastAPI: `/health`, `/predict` | `src/api/` |
| 4.3 | Metadata en respuesta (versión del modelo) | Schema documentado |
| 4.4 | Validación de inputs y errores | Tests API |
| 4.5 | Dockerfile entrenamiento + inferencia | `docker/` |
| 4.6 | Stack local: cliente → API → modelo | Demo técnica |

**Hito:** modelo desplegado + servicio de inferencia + API funcional.

---

### Fase 5 — Demo (Semana 9, opcional)

| ID | Tarea | Entregable |
|----|-------|------------|
| 5.1 | Demo mínima conectada al API | `demo/` |
| 5.2 | Visualización de predicción | Interfaz simple |
| 5.3 | Mostrar versión del modelo | Trazabilidad en UI |

**Referencia:** [demo oficial Burn Scars en Hugging Face](https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M-BurnScars)

---

### Fase 6 — Extensión (Semana 10, opcional)

**Iteración 6 del informe:** segunda tarea para validar reutilización.

| ID | Tarea | Entregable |
|----|-------|------------|
| 6.1 | Config Flood Detection (Sen1Floods11) | `configs/training/flood.yaml` |
| 6.2 | Ejecutar mismo pipeline con nueva config | Evidencia extensibilidad |
| 6.3 | Comparar esfuerzo vs Burn Scars | Documentación |

Solo si Fases 1–4 están estables.

---

### Fase 7 — Validación del sistema (Semana 11)

**Sección 7.3 del informe:** cuatro perspectivas de validación.

| Perspectiva | Qué medir | Documento |
|-------------|-----------|-----------|
| Funcional | Cada componente cumple su rol | Checklist |
| Reproducibilidad | Repetir experimento registrado | `docs/evaluation.md` |
| Desempeño | IoU/mIoU, tiempos de train/inferencia/pipeline | Tablas |
| Extensibilidad | Segunda tarea sin cambiar núcleo MLOps | Si aplica |

---

### Fase 8 — Documentación y cierre (Semana 12)

| ID | Tarea | Entregable |
|----|-------|------------|
| 8.1 | Informe Final | `docs/InformeFinal.md` |
| 8.2 | Instalación y desarrollo | `docs/Instalación.md`, `docs/Desarrollo.md` |
| 8.3 | README final | Punto de entrada completo |
| 8.4 | Reproducibilidad en entorno limpio | Checklist verificada |
| 8.5 | Experimento oficial + tag `v1.0.0` | Release |

---

## 5. Cronograma resumido

| Semana | Fase | Entregable principal | Informe |
|--------|------|----------------------|---------|
| 1 | 0 | Repo + smoke test Colab | Avances Segundo Informe |
| 2–3 | 1 | Baseline reproducible | Segundo Informe |
| 4–5 | 2 | MLflow + registry | — |
| 6 | 3 | Pipeline automatizado | — |
| 7–8 | 4 | API + Docker | — |
| 9 | 5 | Demo (opcional) | — |
| 10 | 6 | Flood (opcional) | — |
| 11 | 7 | Evaluación del sistema | — |
| 12 | 8 | Informe Final + v1.0.0 | Informe Final |

---

## 6. Definition of Done

- [ ] README explica propósito, arquitectura, setup y uso
- [ ] Dataset preparable con pasos documentados (`data/README.md`)
- [ ] Fine-tuning desde `configs/training/burn_scars.yaml`
- [ ] Experimentos trackeados y comparables (MLflow)
- [ ] Modelo registrado con promoción documentada
- [ ] Pipeline `prepare → train → evaluate → register` reproducible
- [ ] Inferencia vía API REST
- [ ] Tests automatizados básicos
- [ ] Experimento final documentado con config y resultados exactos
- [ ] Informe Final describe lo implementado y sus limitaciones

---

## 7. División de roles sugerida

| Carlos (Infra / MLOps) | Zenen (ML / Datos) |
|------------------------|---------------------|
| Repo, CI, Docker | Colab, fine-tuning, métricas |
| MLflow, pipeline, API | Dataset, notebooks, evaluación |
| Docs técnicas | Informes y resultados |

Revisión conjunta semanal: ¿el entrenamiento funciona? ¿qué bloquea?

---

## 8. Acción inmediata (esta semana)

1. Abrir notebook Colab de Burn Scars con GPU T4.
2. Ejecutar smoke test (1–2 epochs).
3. Documentar resultados en Segundo Informe.
4. Descargar dataset a `data/hls_burn_scars/` cuando el smoke test pase.

**No iniciar aún:** MLflow, Docker, API, segunda tarea.

---

## 9. Referencias

- [Primer Informe](./PrimerInforme.md)
- [Arquitectura v1](./architecture/v1.md)
- [ADR 001 — Tarea](./decisions/001-task-selection.md)
- [ADR 002 — Orquestación](./decisions/002-orchestration.md)
- [NASA-IMPACT/Prithvi-EO-2.0](https://github.com/NASA-IMPACT/Prithvi-EO-2.0)
- [TerraTorch-Examples](https://github.com/blumenstiel/TerraTorch-Examples)
