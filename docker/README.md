# docker/

| Servicio | Dockerfile / imagen | Profile | Para qué |
|----------|---------------------|---------|----------|
| `mlflow` | ghcr.io/mlflow/mlflow | default | Tracking |
| `api` | `docker/api/Dockerfile` | default | Inferencia |
| `training` | `docker/training/Dockerfile` | `training` | GPU (NVIDIA) |
| `training-cpu` | `docker/training/Dockerfile.cpu` | `smoke` | Smoke CPU sin NVIDIA |

## Smoke CPU (recomendado en PCs sin GPU)

```bash
cp .env.example .env
docker compose --profile smoke build training-cpu
docker compose --profile smoke run --rm training-cpu \
  python scripts/prepare_data.py --name cifar10_smoke --version 1.0 --download-cpu-smoke
docker compose --profile smoke run --rm training-cpu tune run -s baseline -s optimized
docker compose --profile smoke down
```

Detalle: [docs/research/ComoProbar.md](../docs/research/ComoProbar.md)

## MLflow + API

```bash
docker compose up -d mlflow api
docker compose down
```

## Reglas

- Apagar siempre con `docker compose ... down` al terminar.
- No meter `data/`, pesos ni `.env` en la imagen.
- Caso científico EO = profile `training` o Colab/Kaggle (GPU ~16 GB).
