# Investigación — Tune como laboratorio de fine-tuning eficiente

**Propósito del documento:** sintetizar la investigación que fundamenta Tune y orientar qué medir, qué no asumir y por dónde continuar.  
**Alineado a:** [PrimerInforme.md](./PrimerInforme.md) (problema, objetivos, estado del arte) · [architecture/v1.md](./architecture/v1.md) · ADR 001–003.

---

## 1. Pregunta de investigación

> ¿Es posible adaptar un modelo preentrenado a una tarea concreta usando **menos recursos** (tiempo, memoria GPU, GPU-hours) **sin degradar de forma significativa** la calidad, y dejar evidencia reproducible más un modelo servible?

Tune no inventa LoRA ni MLflow. Investiga si, en un flujo **controlado** (mismo dataset, mismo modelo, mismo hardware, mismo test set), una estrategia *optimized* mejora el costo frente a un *baseline*, y cierra el ciclo con registry + API/CLI.

---

## 2. Hallazgos del estado del arte (síntesis)

### 2.1 Fine-tuning completo vs PEFT (LoRA / QLoRA)

| Enfoque | Qué hace | Implicación para Tune |
|---------|----------|------------------------|
| Full fine-tuning | Actualiza (casi) todos los pesos | Baseline “caro”: más VRAM, checkpoints grandes |
| LoRA / PEFT | Entrena adaptadores de bajo rango (~0.1–1% params) | Candidato *optimized*: menos memoria y almacenamiento |
| QLoRA | LoRA + base cuantizada (p. ej. 4-bit) | Aún más barato; útil si la GPU es justa |

La literatura y la práctica (Hugging Face PEFT, tutoriales MLflow + PEFT) muestran que **el ahorro es frecuente pero no universal**: depende del modelo, la tarea y el hardware. Por eso Tune **mide** tiempo, pico de memoria y calidad; no afirma a priori que “optimized siempre gana”.

### 2.2 MLOps y experiment tracking

MLflow (y análogos) resuelven *qué corrida produjo qué artefacto*. No obligan solos a comparar dos estrategias de eficiencia ni a servir el ganador. Las plataformas cloud (SageMaker, etc.) sí cubren el ciclo completo, fuera de alcance académico.

**Vacío que Tune llena:** integración acotada  
`datos → train(baseline|optimized) → evaluate → register → compare → inferencia`,  
con métricas de **eficiencia + calidad** en un prototipo de grado.

### 2.3 Caso geoespacial (Burn Scars / Prithvi)

- Prithvi-EO-2.0-300M + HLS Burn Scars es un caso **válido y documentado** (TerraTorch, demos en Colab T4 ~16 GB).
- Sen1Floods11 es pivot EO: misma familia de riesgo de VRAM; no “arregla” una GPU chica.
- Plan B (ResNet + dataset chico) preserva la pregunta de investigación si el cómputo EO bloquea.

El caso valida la arquitectura; **no la define** (ADR 001).

### 2.4 Compute en este proyecto

| Entorno | Rol |
|---------|-----|
| PC de desarrollo (~8 GB RAM, sin NVIDIA) | Código, docs, tests, MLflow/API. **No entrenar Prithvi.** |
| Colab / Kaggle (free-tier) | Smoke y corridas cuando no hay lab |
| GPU universitaria | Hardware de **referencia** del par experimental (acordar con tutor) |

Baseline y optimized deben medirse en el **mismo** hardware documentado.

---

## 3. Hipótesis de trabajo

1. **H1 (eficiencia):** bajo las mismas condiciones de datos y evaluación, la estrategia optimized reduce al menos una métrica de recurso (tiempo o memoria o GPU-hours) frente al baseline.
2. **H2 (calidad):** la caída de la métrica primaria (p. ej. mIoU) no supera el umbral acordado (`max_quality_drop_vs_baseline`, hoy 0.02 provisional).
3. **H3 (MLOps):** el pipeline deja cada corrida recuperable (params, métricas, artefacto) y un modelo promovido consumible por API/CLI con versión.

Si H1 falla (no hay ahorro), el resultado **sigue siendo válido**: Tune midió. No se atribuye el (no) ahorro a “la arquitectura”.

---

## 4. Variables y evidencia a exponer

| Dimensión | Variables | Dónde vive |
|-----------|-----------|------------|
| Calidad | mIoU / IoU / F1 (o accuracy en Plan B) | Evaluator + MLflow metrics |
| Eficiencia | wall time, peak GPU memory, GPU-hours (o proxy) | `ResourceProbe` + logs |
| Reproducibilidad | seed, config YAML, hardware, run repetido | configs + informe |
| Servicio | latencia, `model_version` en `/predict` | API |

**Producto de investigación del proyecto:** tabla (o gráfico) baseline vs optimized + interpretación escrita + limitaciones (GPU, free-tier, caso).

---

## 5. Posicionamiento frente a alternativas

| Enfoque | Entrena | Compara eficiencia | Tracking | API | Alcance académico |
|---------|:-------:|:------------------:|:--------:|:---:|:-----------------:|
| Script / notebook solo | ✓ | ✗ | raro | ✗ | frágil |
| Trainer (HF / TerraTorch) | ✓ | parcial | integrable | externo | incompleto |
| MLflow solo | ✗ | parcial | ✓ | integrable | incompleto |
| Cloud MLOps | ✓ | ✓ | ✓ | ✓ | fuera de alcance |
| **Tune** | ✓ | **✓ núcleo** | ✓ | ✓ | **prototipo** |

---

## 6. Implicaciones para el diseño (ya aplicadas en el repo)

1. Clean architecture: `domain` (reglas) ↔ `application` (stages) ↔ `infrastructure` (torch/mlflow) ↔ `interfaces` (CLI/API).
2. Estrategias solo en YAML (`precision`, `peft`); mismo dataset/modelo/seed.
3. Promoción por umbrales explícitos (`thresholds.yaml`), no a ojo.
4. Caso intercambiable: cambiar Evaluator + DataModule + configs, no el núcleo.
5. CI sin entrenar: el laboratorio se prueba sin GPU; el experimento corre fuera de CI.

---

## 7. Qué falta investigar / decidir (bloqueos activos)

- [ ] Métrica primaria y umbrales con el tutor → `thresholds.yaml` + ADR 001
- [ ] GPU de referencia (lab vs free-tier) → propuesta tutor
- [ ] Viabilidad smoke Burn Scars en T4 / lab → pivot o Plan B
- [ ] Cómo llegan a MLflow los runs de Colab/Kaggle → **ADR 003** (pendiente de redactar tras el primer smoke)
- [ ] Interpretación del primer par experimental (aunque “no ahorró”)

---

## 8. Referencias rápidas

- Primer informe — secciones 5–6 (solución y estado del arte)
- [PEFT / LoRA (Hugging Face)](https://huggingface.co/docs/peft)
- [MLflow + PEFT fine-tuning](https://mlflow.org/docs/latest/ml/deep-learning/transformers/tutorials/fine-tuning/transformers-peft/)
- [Prithvi-EO-2.0-300M](https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M)
- [HLS Burn Scars](https://huggingface.co/datasets/ibm-nasa-geospatial/hls_burn_scars)
- [Sen1Floods11](https://github.com/cloudtostreet/sen1floods11)

---

## 9. Conclusión operativa

La investigación respalda un laboratorio **pequeño, medible y desacoplado del caso**. El camino no es “terminar la UI” ni “cambiar de modelo cada semana”: es cerrar **un** par experimental trazable y servible. Si el cómputo EO falla, se cambia el caso; la pregunta de investigación permanece.
