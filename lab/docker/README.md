# docker/ del laboratorio

| Servicio | Dockerfile | Profile | Para qué |
|----------|------------|---------|----------|
| `mlflow` | imagen oficial | default | Tracking |
| `api` | `lab/docker/api/Dockerfile` | default | API del registry (puerto 8001) |
| `training` | `docker/eo/Dockerfile` | `training` | GPU |
| `training-cpu` | `docker/eo/Dockerfile.cpu` | `smoke` | Smoke CPU |

Desde la raíz:

```bash
make -C lab experiment
make -C lab smoke-run
```

Protocolo: [docs/research/ComoProbar.md](../docs/research/ComoProbar.md).
