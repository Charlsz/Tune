# Propuesta para reunión con el tutor

**Estado:** Borrador  
**Fecha:** 2026-09-10  
**Actualizado:** 2026-09-15  

**Contexto en repo:** scaffold Tune listo (CLI `tune`, Docker Compose, CI, 18 tests), configs YAML en borrador, umbrales provisionales. Falta ratificar caso, métricas y hardware de referencia.

---

## 1. Qué es Tune

Tune es un laboratorio MLOps: mismo dataset, mismo modelo, dos estrategias. Medimos si la barata usa menos GPU/tiempo sin perder mucha calidad, y servimos el modelo por API. El caso (incendios / satélite) es el ejemplo, no el producto.

---

## 2. Hardware

Hay GPU en el laboratorio universitario. **No sabemos modelo ni VRAM.** Baseline y optimized tienen que correr en esa misma máquina de referencia.

**PC personal (Carlos):** Windows 11, ~8 GB RAM, Intel Iris Xe (sin NVIDIA). No sirve para entrenar Prithvi; solo para código, docs, MLflow local y API.

**Free-tier (smoke / corridas si el lab no alcanza):**

| Opción | Qué esperar | Uso en Tune |
|--------|-------------|-------------|
| Kaggle | ~30 h GPU/semana publicadas; T4/P100 típicos | Preferido para cuotas predecibles |
| Colab Free | T4 cuando hay cupo; límites opacos | Smoke y notebooks de ejemplo |
| Lab universidad | GPU desconocida; debe ser la referencia oficial del par experimental | Corridas “oficiales” baseline vs optimized |

Preguntar en la reunión:

1. ¿Qué GPU es (modelo y GB)? Si no lo tiene a mano: en el lab, `nvidia-smi`.
2. ¿Esa GPU es la referencia oficial del par experimental?
3. ¿Colab/Kaggle solo para smoke tests, o también para corridas oficiales si el lab no alcanza?

Anotar aquí:

- Modelo GPU:
- VRAM:
- ¿Referencia oficial? sí / no
- Colab/Kaggle: oficial / solo smoke

Prithvi-300M en fine-tuning completo suele ir cómodo en **16+ GB** (Colab T4 = 16 GB es el escenario documentado por NASA/IBM para demos). Si el lab tiene **8 GB o menos**, el Caso A probablemente no cabe. Si está en 10–12 GB, smoke con batch pequeño antes de comprometerse.

---

## 3. Métrica primaria

**Lo que Tune mide siempre (eficiencia):** tiempo de entrenamiento, pico de memoria GPU, GPU-hours. Eso no se vota; es el aporte del laboratorio.

**Lo que sí hay que preguntarle:** la métrica de *calidad* que decide promoción.

| Si el caso es… | Nuestra sugerencia | Preguntar |
|----------------|--------------------|-----------|
| Segmentación (Caso A, Burn Scars) | **mIoU** (IoU y F1 como secundarias) | ¿mIoU te parece la primaria, o prefieres IoU de la clase “quemado” / F1? |
| Clasificación (Plan B liviano) | **accuracy** (macro-F1 secundaria) | ¿accuracy o F1? |

Umbrales provisionales en `configs/pipeline/thresholds.yaml`:

- piso: `min_primary_metric = 0.60`
- caída máxima de optimized vs baseline: `0.02`

Preguntar: *¿te parecen bien esos números como piso académico, o los cambias antes de la primera corrida?*  
No discutir SOTA. El piso es “el modelo aprendió algo”.

---

## 4. Par de estrategias

Borrador en `configs/training/`:

| | Baseline (caro) | Optimized (barato) |
|---|-----------------|--------------------|
| Qué cambia | Full fine-tuning, FP32, sin LoRA | LoRA (r=8, alpha=16) + FP16 mixed |
| Qué no cambia | Mismo dataset, modelo, seed 42, epochs, batch, learning rate | Igual |

Preguntar:

1. ¿Este par te parece el experimento correcto (full FT vs LoRA+FP16)?
2. ¿Quieres otra técnica en optimized (solo FP16, QLoRA, solo early stopping)?
3. ¿20 epochs / batch 8 es razonable para el lab, o empezamos más chico para un smoke?

Si el tutor cambia la técnica, se actualizan los YAML. Tune no se redefine: sigue comparando dos configs.

---

## 5. Caso A, pivot inundaciones, Plan B

Escalera (en orden; no saltar al Plan B sin smoke):

1. **Caso A (preferido):** HLS Burn Scars + Prithvi-EO-2.0-300M, segmentación.
2. **Pivot EO (solo si Burn Scars falla por datos/tooling, no por VRAM):** Sen1Floods11 + Prithvi (mismo orden de magnitud de VRAM; no “arregla” una GPU chica).
3. **Plan B (si no hay VRAM suficiente):** ResNet-50 + `beans` (o CIFAR-10), clasificación, mismo pipeline Tune.

No abrir la reunión con “vamos a Plan B”. Abrir con Caso A. El Plan B se menciona si él pregunta por riesgo de GPU o si `nvidia-smi` muestra poca VRAM.

### Caso A

| Campo | Valor |
|-------|-------|
| Tarea | Segmentación semántica (cicatrices de incendio) |
| Dataset | HLS Burn Scars (público, versionado fuera de Git) |
| Modelo | `ibm-nasa-geospatial/Prithvi-EO-2.0-300M` |
| Métrica primaria sugerida | mIoU (IoU / F1 secundarias) |
| Condición | GPU con VRAM suficiente (cómodo: 16+ GB; smoke en T4 documentado) |

### Pivot inundaciones (mismo stack EO)

| Campo | Valor |
|-------|-------|
| Dataset | Sen1Floods11 |
| Modelo | Prithvi (100M o 300M según VRAM) |
| Nota | Misma familia de riesgo de cómputo; útil si Burn Scars bloquea por datos/ecosistema |

### Plan B (si el lab / free-tier no aguanta Prithvi)

| Campo | Valor |
|-------|-------|
| Tarea | Clasificación de imágenes |
| Modelo | `microsoft/resnet-50` (Hugging Face) |
| Dataset | `beans` (~1k imágenes, 3 clases) o CIFAR-10 |
| Métrica primaria sugerida | accuracy (macro-F1 secundaria) |
| Por qué | Cabe en GPU chica / Colab T4; mismo pipeline Tune; no depende de TerraTorch |

---

## 6. Cerrar la reunión (anotar respuestas)

- [ ] Métrica primaria: _______________
- [ ] Umbrales: 0.60 / 0.02 u otros: _______________
- [ ] Estrategias: baseline = _______________ / optimized = _______________
- [ ] GPU lab (modelo + VRAM) = _______________ → Caso A / pivot floods / Plan B
- [ ] Hardware de corridas oficiales: lab / Kaggle / Colab
- [ ] Próximo hito acordado: datos + baseline reproducible (sin UI)

Después de la reunión: actualizar [ADR 001](./001-task-selection.md) y `configs/pipeline/thresholds.yaml` con *lo que él dijo*.
