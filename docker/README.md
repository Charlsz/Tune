# docker/

Imágenes del proyecto. La orquestación local está en `../docker-compose.yml`.

| Servicio   | Imagen / Dockerfile          | Puerto | Para qué |
|------------|------------------------------|--------|----------|
| `mlflow`   | `ghcr.io/mlflow/mlflow`      | 5000   | Tracking + Model Registry. Persiste en el volumen `mlflow-data`. |
| `api`      | `docker/api/Dockerfile`      | 8000   | FastAPI: `/health`, `/model`, `/predict`. Resuelve el modelo por alias `approved`. |
| `training` | `docker/training/Dockerfile` | —      | PyTorch + CUDA. Solo con `--profile training`. Monta `data/`, `configs/`, `artifacts/`, `src/`. |

## Comandos

```bash
cp .env.example .env
docker compose up -d mlflow api                  # UI MLflow en http://localhost:5000, API en :8000
docker compose --profile training run --rm training tune train -s baseline
docker compose down                              # -v para borrar también los runs de MLflow
```

## Reglas

- Nunca copiar `data/`, `mlruns/`, pesos ni `.env` dentro de una imagen (ver `.dockerignore`).
- Los servicios se hablan por nombre (`http://mlflow:5000`); desde el host es `localhost`.
- GPU: requiere NVIDIA Container Toolkit. Sin GPU el servicio `training` arranca igual en CPU
  (útil para smoke tests con subsets pequeños). Si Compose falla por el bloque `deploy`,
  comentarlo temporalmente.
- Entrenar en Colab/Kaggle sigue siendo válido: apuntar `MLFLOW_TRACKING_URI` al servidor
  local expuesto (túnel) o exportar los runs. Decisión pendiente en ADR 003.
