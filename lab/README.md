# Laboratorio de fine-tuning (secundario)

Comparar **baseline** vs **optimized** sobre un modelo preentrenado. No es el producto que se demuestra: la app está en la raíz (`make app-up`).

Respaldo íntegro: rama `backup/mlops-finetuning-lab`.

## Arranque (desde la raíz del repo)

```bash
cp .env.example .env
make -C lab experiment        # Prithvi, 2 epochs (o: make lab-experiment)
make -C lab down
```

Smoke CPU (sin NVIDIA):

```bash
make -C lab smoke-build
make -C lab smoke-data
make -C lab smoke-run
make -C lab smoke-down
```

Detalle: [docs/research/ComoProbar.md](./docs/research/ComoProbar.md) · [docs/research/RevisionLab.md](./docs/research/RevisionLab.md).

## Contenido

| Ruta | Qué es |
|---|---|
| `configs/` | YAML baseline / optimized / umbrales |
| `scripts/` | `prepare_data.py`, `run_pipeline.py` |
| `data/` | datasets (fuera de Git) |
| `docker-compose.yml` | MLflow + training GPU + smoke CPU |
| `docker/api/` | imagen ligera del registry (no es la app) |
| `docs/` | arquitectura v1, investigación, cómo probar |

La imagen GPU se construye desde [`docker/eo/Dockerfile`](../docker/eo/Dockerfile) (la misma de la app).
