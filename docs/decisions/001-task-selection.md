# ADR 001: Selección de tarea geoespacial principal

**Estado:** Aceptado  
**Fecha:** 2026-08-17  
**Contexto:** [Primer Informe](../PrimerInforme.md) — secciones 3, 4 y 5

## Contexto

El primer informe define una arquitectura MLOps para modelos geoespaciales basados en **Prithvi-EO-2.0**, integrando **TerraTorch** para fine-tuning, **MLflow** para experiment tracking y model registry, y una **API REST** para inferencia.

El alcance inicial contempla **una o dos tareas** geoespaciales. La solución propuesta menciona explícitamente:

- **Flood Detection** (detección de inundaciones)
- **Wildfire Scar Detection** (detección de cicatrices de incendio)

Para iniciar la implementación se requiere seleccionar **una tarea principal** que permita validar el flujo completo con el menor riesgo técnico.

## Opciones consideradas

| Tarea | Dataset | Soporte TerraTorch | Complejidad inicial |
|-------|---------|--------------------|---------------------|
| Wildfire Scar Detection | [hls_burn_scars](https://huggingface.co/datasets/ibm-nasa-geospatial/hls_burn_scars) | Config YAML + notebook Colab oficial | Baja |
| Flood Detection | [Sen1Floods11](https://github.com/cloudtostreet/Sen1Floods11) | Config YAML + notebook Colab oficial | Media |
| Crop Classification | Multi-temporal crop (US) | Notebook disponible | Media-alta |
| Landslide Detection | Landslide4sense | Config disponible | Media-alta |

## Decisión

**Tarea principal:** Wildfire Scar Detection (Burn Scars)  
**Modelo:** Prithvi-EO-2.0-300M-TL  
**Framework:** TerraTorch  
**Métricas:** IoU, mIoU, F1, precision, recall (segmentación semántica)

**Tarea secundaria (opcional):** Flood Detection — solo si los recursos y el cronograma lo permiten, para validar extensibilidad (objetivo específico 7 del primer informe).

## Justificación

1. **Alineación con el primer informe:** Burn Scars está citada en la sección 5 como ejemplo de tarea downstream de Prithvi-EO-2.0.
2. **Recursos oficiales:** IBM/NASA publicaron config, notebook Colab y modelo fine-tuned de referencia en Hugging Face.
3. **Dataset accesible:** El dataset `hls_burn_scars` está en Hugging Face con licencia compatible con uso académico.
4. **Entorno de desarrollo:** El notebook oficial funciona en Google Colab con GPU T4 (tier gratuito).
5. **Métricas definidas:** Tarea de segmentación, coherente con la estrategia de validación del informe (sección 7.3).

## Consecuencias

- La configuración baseline reside en `configs/training/burn_scars.yaml`.
- Los datos se almacenan localmente en `data/hls_burn_scars/` (no versionados en Git).
- La API y el demo inicial expondrán predicciones de cicatrices de incendio.
- La validación de extensibilidad (segunda tarea) queda diferida a una fase posterior.

## Referencias

- [Primer Informe — Solución propuesta](../PrimerInforme.md#5-solución-propuesta)
- [TerraTorch-Examples — Burn Scars notebook](https://github.com/blumenstiel/TerraTorch-Examples/blob/main/prithvi_v2_eo_300_tl_unet_burnscars.ipynb)
- [Prithvi-EO-2.0 — Downstream tasks](https://github.com/NASA-IMPACT/Prithvi-EO-2.0)
