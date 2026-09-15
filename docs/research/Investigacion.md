# Investigación — Tune: fine-tuning eficiente medible

**Qué es este documento:** marco de investigación del laboratorio Tune (pregunta, hipótesis, método, decisiones).  
**Alineado a:** [PrimerInforme.md](../PrimerInforme.md) · [architecture/v1.md](../architecture/v1.md) · [003-protocolo-experimental.md](../decisions/003-protocolo-experimental.md) · [ComoProbar.md](./ComoProbar.md).

---

## 1. Pregunta

> ¿Es posible adaptar un modelo preentrenado usando **menos recursos** (tiempo, memoria GPU, GPU-hours) **sin degradar de forma significativa** la calidad, con evidencia reproducible y un modelo servible?

Tune no inventa LoRA ni MLflow. Integra un flujo controlado (mismo dataset, modelo, hardware y test set) para **medir** baseline vs optimized.

---

## 2. Hipótesis

1. **H1 (eficiencia):** optimized reduce al menos una métrica de recurso frente al baseline.  
2. **H2 (calidad):** la métrica primaria no cae más que `max_quality_drop_vs_baseline`.  
3. **H3 (MLOps):** cada corrida es recuperable y existe un modelo promovido consumible por API/CLI con versión.

Si H1 falla bajo protocolo, el resultado sigue siendo válido: el laboratorio midió.

---

## 3. Síntesis del estado del arte

| Pieza | Aporta | No aporta sola |
|-------|--------|----------------|
| Full FT vs LoRA/PEFT/QLoRA | Candidatos caro/barato | Comparación obligatoria ni API |
| Trainers (Lightning, HF, TerraTorch) | Ejecutar train | Pipeline de eficiencia + registry + serve |
| MLflow | Tracking / registry | Forzar par experimental de eficiencia |
| Cloud MLOps | Ciclo completo | Alcance/costo de este prototipo |

**Vacío:** integración acotada `datos → train×2 → evaluate → register → compare → inferencia` con métricas de **eficiencia + calidad**.

Efectividad de PEFT: frecuente, no universal (depende de modelo, tarea, hardware). Por eso Tune mide.

---

## 4. Método

- **Diseño:** un modelo, un dataset, dos estrategias (configs YAML).  
- **Instrumentación:** wall time, peak VRAM, calidad en el mismo test set.  
- **Promoción:** umbrales en `thresholds.yaml` + `decide_promotion()`.  
- **Caso:** Burn Scars / Prithvi; escalera en ADR 003.  
- **Compute:** desarrollo local sin GPU; experimentos en Kaggle/Colab (o lab si existe), **mismo** host para el par.

---

## 5. Decisiones activas

Documentadas en [ADR 003](./decisions/003-protocolo-experimental.md). Resumen:

- mIoU (seg.) / accuracy (Plan B)  
- umbrales 0.60 / 0.02  
- baseline FP32 full FT vs LoRA+FP16  
- free-tier aceptable como hardware oficial del par si se documenta  

---

## 6. Evidencia a producir

| Entrega | Contenido |
|---------|-----------|
| Tabla/gráfico | tiempo, memoria, GPU-hours, calidad (baseline vs optimized) |
| Runs MLflow | configs, seeds, hardware, artefactos |
| Interpretación | ahorro o no-ahorro; sin atribuir speedup de LoRA a “la arquitectura” |
| Servicio | `/predict` (o CLI) con `model_version` |

---

## 7. Trabajo abierto (investigación aplicada)

- [ ] Smoke Burn Scars (1 epoch / subset)  
- [ ] Implementar trainer + evaluator  
- [ ] Completar `MlflowTracker.get_run` y flujo Colab/Kaggle → MLflow  
- [ ] Par optimized + interpretación  
- [ ] ADR 004: tracking remoto detallado tras el primer smoke  

---

## 8. Referencias

- PEFT / LoRA — Hugging Face  
- MLflow + PEFT tutorials  
- Prithvi-EO-2.0-300M · HLS Burn Scars · Sen1Floods11  
- Primer informe Tune — secciones 5–6  
