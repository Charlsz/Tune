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

## Segunda revisión (2026-09-21, tarde) — bugs que impedían resultados válidos

Tests y lint pasaban, pero el flujo real nunca había corrido de punta a punta. Al leer
el código contra los repos reales de HF se encontraron estos errores (todos corregidos
en `fix/lab-pipeline`):

| # | Problema | Efecto | Arreglo |
|---|----------|--------|---------|
| 1 | El repo HF `hls_burn_scars` publica **un `hls_burn_scars.tar.gz` (2.6 GB)**, no tifs sueltos. `prepare_data` hacía `rglob("*.tif")` sobre el snapshot → 0 archivos, y aun así escribía metadata y terminaba "OK" | `data/` vacío; TerraTorch moría con 0 imágenes. **Causa raíz de que el lab nunca entrenara** | `collect_geotiffs` extrae el tar a `data/hls_burn_scars/1.0/_raw/`; la validación y `make lab-data` exigen `*_merged.tif` reales |
| 2 | El evaluador buscaba `metrics.csv` bajo `checkpoints/` y Lightning usaba TensorBoard por defecto → nunca lo encontraba y devolvía `miou = 0.0` en silencio | Todo REJECTED, `compare` comparaba ceros | `CSVLogger` explícito en el YAML; se lee el `metrics.csv` nuevo tras `terratorch test`; si no hay IoU se lanza error en vez de inventar 0 |
| 3 | VRAM pico medida con `torch.cuda.max_memory_allocated()` en el proceso padre, pero el fit corre en subprocess | `peak_gpu_memory_mb = 0` siempre; además el padre inicializaba CUDA y robaba VRAM | `ExternalGpuProbe`: muestrea `nvidia-smi` cada 2 s durante el subprocess y resta la memoria base |
| 4 | Si `terratorch fit` fallaba, se reintentaba con otro entrypoint | Un OOM a los 40 min → otros 40 min para fallar igual | Un solo intento, error claro |
| 5 | Caché HF no persistida | Tar 2.6 GB + pesos Prithvi 1.2 GB se re-descargaban en cada `compose run --rm` | Volumen `hf-cache` + `HF_HOME` |
| 6 | `terratorch` sin pin | Un release nuevo puede arrastrar otro torch/CUDA en pleno build | `terratorch==1.2.13` (verificado compatible con torch 2.4) |
| 7 | `optimized.yaml` declaraba `peft: lora` pero el trainer EO no lo aplica | Informe diría LoRA sin serlo | `peft: null` + `freeze_backbone: true`; el ahorro es freeze + FP16 |
| 8 | Splits en modo `--max-files` truncaban los oficiales (escenas que no se copiaron); fallback escribía `_merged.tif` en el split, que TerraTorch compara por substring y dejaba fuera las máscaras | Smoke con 0 pares | Smoke genera splits desde lo copiado; las líneas son el stem común imagen/máscara |

**Qué pedirle a la U tras hacer `git pull`:** si ya existe `data/hls_burn_scars/1.0` con
`data/` vacío, `make lab-data` lo detecta solo y vuelve a descargar (ahora extrae el tar).
Primera vez: cuenta con ~10 min extra de extracción.

## Regla anti-pérdida de días

Si el `docker pull` o el build **no muestran progreso en ~20 minutos** → Ctrl+C y avisar.
No dejar procesos “por si acaso” de noche sin mirar.
