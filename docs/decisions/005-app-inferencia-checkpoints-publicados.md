# ADR 005 — Aplicación de análisis EO con checkpoints publicados (sin fine-tuning propio)

**Fecha:** 2026-09-21 · **Estado:** Aceptado (visto bueno del tutor por WhatsApp, 21-09) ·
**Sustituye el eje de:** [ADR 001](./001-task-selection.md), [ADR 003](./003-protocolo-experimental.md)

## Contexto

Desde el 17-09 el flujo `make lab-experiment` no logró completar una corrida en la máquina de la
universidad (descarga de la imagen base de Docker bloqueada; ver
[RevisionLab.md](../research/RevisionLab.md)). Al revisar el código se encontraron además errores
que habrían invalidado los resultados (dataset no extraído, mIoU siempre 0, VRAM no medida). Con
entrega el viernes 25-09 y el tutor advirtiendo que el alcance era ambicioso, depender de corridas
largas de fine-tuning en GPU para cada resultado es un riesgo que no podemos asumir.

## Decisión

Tune pasa a ser una **aplicación de análisis de imágenes satelitales**:

- Usa los checkpoints que IBM-NASA publicó **ya fine-tuneados** en Hugging Face:
  `Prithvi-EO-2.0-300M-TL-Sen1Floods11` (inundaciones, Sentinel-2) y
  `Prithvi-EO-2.0-300M-BurnScars` (cicatrices de incendio, HLS). Ambos comparten las mismas 6
  bandas de entrada, así que un solo pipeline sirve para las dos tareas.
- La inferencia sigue el `inference.py` oficial de cada repo (TerraTorch
  `LightningInferenceModel`, ventana deslizante 512×512).
- Producto: subir GeoTIFF → máscara georreferenciada sobre mapa + % y km² afectados + historial.
- El laboratorio de fine-tuning (baseline vs optimized) **se conserva** como componente secundario
  y queda respaldado íntegro en la rama `backup/mlops-finetuning-lab`.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Seguir con fine-tuning como núcleo | Sin resultado en 4 días; no hay margen para el viernes |
| Solo cambiar Burn Scars → inundaciones | No resuelve el problema (infraestructura/GPU), solo el dominio |
| Plan B ResNet/CIFAR | Sin aplicación práctica; no aprovecha Prithvi ni lo construido |

## Consecuencias

- Resultados funcionales sin GPU (CPU sirve; GPU acelera). Se puede demostrar en cualquier PC.
- Lo construido se reutiliza: arquitectura por capas, FastAPI, CLI Typer, Docker Compose, imagen
  ML con TerraTorch, caché HF.
- Nuevo frontend (`web/`, Vite + React + Leaflet). Persistencia en disco (`artifacts/analyses/`);
  PostGIS solo si más adelante hace falta consulta espacial.
- El informe debe presentar Tune como sistema de ingeniería (ingesta, inferencia, API,
  visualización, despliegue) y no como experimento de eficiencia. `PrimerInforme.md` sigue congelado.
