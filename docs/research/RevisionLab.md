# Revisión del flujo lab (2026-09-21) — qué está bien y qué cambió

## Hallazgos de la revisión

1. **El hang del viernes** no era entrenamiento: Docker se quedó bajando
   `pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime` (imagen grande). Sin progreso visible
   durante horas = cancelar, no esperar el fin de semana.

2. **`lab-experiment` antiguo** lanzaba **20 epochs × 2** sobre el corpus completo.
   Eso es correcto para el paper, pero arriesgado con deadline el viernes si el
   build ya consume medio día.

3. **Layout Burn Scars** (`data/` + `splits/*.txt`) ya es aceptado por `prepare`.

4. **Disco**: con >200G libres el riesgo de OOM de disco baja; igual vigilar
   `artifacts/` y caché Docker.

## Qué hace ahora `make lab-experiment` (recomendado)

1. Preflight (fecha, GPU, disco)  
2. `docker pull` de la base PyTorch **aparte** (ves el %)  
3. Build imagen training (logs en texto plano)  
4. Datos: **omite descarga** si `data/hls_burn_scars/1.0` ya existe  
5. Entrena baseline + optimized con **`configs/eo_friday`** (2 epochs, batch 2)  
6. Apaga contenedores  

Otros:
- `make lab-experiment-full` → 20 epochs (después del viernes)  
- `make lab-experiment-smoke` → subset mínimo (solo debug)

## Regla anti-pérdida de días

Si el `docker pull` o el build **no muestran progreso en ~20 minutos** → Ctrl+C y avisar.
No dejar procesos “por si acaso” de noche sin mirar.
