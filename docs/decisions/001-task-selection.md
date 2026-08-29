# ADR 001: Selección del caso de estudio

**Estado:** Actualizado (Tune)  
**Fecha original:** 2026-08-17  
**Actualizado:** 2026-08-29  
**Contexto:** [Primer Informe](../PrimerInforme.md) — secciones 3, 4 y 5

## Contexto

El primer informe define **Tune**: un laboratorio MLOps para comparar fine-tuning baseline versus optimizado y servir el modelo elegido. El éxito del proyecto **no** depende de un backbone ni de un dominio concretos.

Sí hace falta **un** caso de estudio (1 modelo preentrenado + 1 dataset) para validar el flujo. Un segundo caso es opcional y solo se aborda si el mínimo experimental ya está cerrado.

La decisión previa (Terra) fijaba Wildfire Scar Detection + Prithvi-EO-2.0 + TerraTorch como eje. Esa elección se conserva solo como **candidato preferido**, con plan B obligatorio.

## Opciones consideradas

| Caso | Dataset | Notas | Riesgo |
|------|---------|-------|--------|
| Geoespacial / cicatrices de incendio | HLS Burn Scars | Reutiliza exploración previa; tooling EO joven | Medio-alto (GPU y ecosistema) |
| Otro modelo de visión más liviano | Dataset público acotado | Menor costo de entrenamiento | Bajo-medio |
| Otra tarea con trainer estable (p. ej. Hugging Face) | Dataset académico permitido | Menos acoplado a EO | Bajo-medio |

## Decisión

**Caso preferido inicial:** tarea geoespacial de cicatrices de incendio (HLS Burn Scars) con un modelo preentrenado compatible, **si** el cómputo y el tooling lo permiten.

**Plan B:** sustituir por un modelo y un dataset más livianos o estables. Tune no se redefine.

**Métricas de calidad:** las de la tarea elegida (en segmentación: IoU, mIoU, F1, precision, recall).  
**Métricas de eficiencia (siempre):** tiempo de entrenamiento, memoria GPU, GPU-hours o proxy.

**No se declara** una segunda tarea EO (Flood) como extensión por defecto. La extensión, si existe, es un segundo par experimental, no “otra app de satélites”.

## Justificación

1. **Alineación con Tune:** el laboratorio debe poder cambiar de caso sin perder el aporte (comparar estrategias y servir el modelo).
2. **Continuidad:** si Burn Scars / Prithvi siguen siendo viables, se aprovecha trabajo ya explorado.
3. **Riesgo de calendario:** un ecosistema joven o una GPU insuficiente no puede tumbar el proyecto.
4. **Dataset académico:** se usarán datos públicos o de uso permitido, versionados fuera de Git.

## Consecuencias

- Las configs viven en `configs/training/` como `baseline` y `optimized`, no como “la config de Prithvi”.
- Los datos se almacenan en `data/` (no versionados en Git).
- La API expone el input/output de **la tarea del caso** (p. ej. una imagen → máscara), más la versión del modelo.
- Si el caso preferido bloquea, se actualiza este ADR con el caso de respaldo; no se reescribe el objetivo general.

## Referencias

- [Primer Informe — Solución propuesta](../PrimerInforme.md#5-solución-propuesta)
- [Arquitectura v1](../architecture/v1.md)
