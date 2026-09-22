# 004 — Propuesta reunión tutor (Fase 0)

**Estado:** Borrador  
**Fecha:** 2026-09-10  

 repo, CLI `tune`, 18 tests, configs YAML en borrador, umbrales provisionales.

---

## 1. Tune

Tune es un laboratorio MLOps: mismo dataset, mismo modelo, dos estrategias. Medimos si la barata usa menos GPU/tiempo sin perder mucha calidad, y servimos el modelo por API. El caso (incendios / satélite) es el ejemplo, no el producto.

---

## 2. Hardware 

Hay GPU en el laboratorio. **No sabemos modelo ni VRAM.** Baseline y optimized tienen que correr en esa misma máquina.

Preguntar:

1. ¿Qué GPU es (modelo y GB)? Si no lo tiene a mano: en el lab, `nvidia-smi`.
2. ¿Esa GPU es la referencia oficial del par experimental?
3. ¿Colab/Kaggle solo para smoke tests?

Anotar aquí en la reunión:

- Modelo GPU:
- VRAM:
- ¿Referencia oficial? sí / no
- Colab: oficial / solo smoke

 Prithvi-300M en fine-tuning completo suele ir cómodo en **16+ GB**. Si el lab tiene **8 GB o menos**, el Caso A probablemente no cabe y hay que hablar del Plan B. Si está en el medio (10–12 GB), se prueba un smoke antes de comprometerse.

---

## 3. ¿qué métrica primaria?

**Lo que Tune mide siempre (eficiencia):** tiempo de entrenamiento, pico de memoria GPU, GPU-hours. Eso no se vota; es el aporte del laboratorio.

**Lo que sí hay que preguntarle:** la métrica de *calidad* que decide promoción.

| Si el caso es… | Nuestra sugerencia | Preguntar |
|----------------|--------------------|-----------|
| Segmentación (Caso A, Burn Scars) | **mIoU** (IoU y F1 como secundarias) | ¿mIoU te parece la primaria, o prefieres IoU de la clase “quemado” / F1? |
| Clasificación (Plan B) | **accuracy** (macro-F1 secundaria) | ¿accuracy o F1? |

Umbrales que hoy están en `lab/configs/pipeline/thresholds.yaml` (provisionales):

- piso: `min_primary_metric = 0.60`
- caída máxima de optimized vs baseline: `0.02`

Preguntar: *¿te parecen bien esos números como piso académico, o los cambias antes de la primera corrida?*  
No discutir SOTA. El piso es “el modelo aprendió algo”.

---

## 4. Preguntar: ¿qué par de estrategias?

Ya hay un borrador en `lab/configs/training/`. Llevarlo como punto de partida:

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

## 5. Caso A vs Plan B (solo si la GPU no da)

**Caso A (preferido, si la VRAM alcanza):** HLS Burn Scars + Prithvi-EO-2.0-300M, tarea segmentación.

**Plan B (si el lab no aguanta Prithvi):** ResNet-50 + `beans` (o CIFAR-10), clasificación, mismo pipeline.

No abrir con “vamos a Plan B”. Abrir con Caso A. El Plan B se menciona si él pregunta por riesgo de GPU o si `nvidia-smi` muestra poca VRAM.

### Plan A (preferido)

| Campo | Valor |
|-------|-------|
| Tarea | Segmentación semántica (cicatrices de incendio) |
| Dataset | HLS Burn Scars (público, versionado fuera de Git) |
| Modelo | `ibm-nasa-geospatial/Prithvi-EO-2.0-300M` |
| Métrica primaria sugerida | mIoU (IoU / F1 secundarias) |
| Condición | GPU del lab con VRAM suficiente (cómodo: 16+ GB) |

### Plan B (si el lab no aguanta Prithvi)

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
- [ ] GPU lab (modelo + VRAM) = _______________ → Caso A o Plan B
- [ ] Próximo hito acordado: Fase 1 (datos + baseline), sin UI

Después de la reunión: actualizar [ADR 001](./001-task-selection.md) y `thresholds.yaml` con *lo que él dijo*. Ahí se cierran 0.5 y 0.6.
