# Tune

Aplicación de **análisis de imágenes satelitales** para detectar **inundaciones** y **cicatrices de incendio** usando los modelos **Prithvi‑EO 2.0** que IBM‑NASA ya publicó fine‑tuneados en Hugging Face. Subes un GeoTIFF, Tune corre el modelo y muestra la máscara sobre un mapa con área afectada e historial.

No entrenamos: se usan checkpoints publicados ([ADR 005](./docs/decisions/005-app-inferencia-checkpoints-publicados.md)). El laboratorio de fine‑tuning original se conserva como componente secundario (rama `backup/mlops-finetuning-lab` y `make lab-*`).

## App — empezar (Docker)

```bash
cp .env.example .env
make app-up          # CPU (tu PC)         -> http://localhost:8080
make app-up-gpu      # con NVIDIA (lab U)  -> http://localhost:8080
make app-logs        # la primera inferencia descarga ~1.2 GB de pesos
make app-down
```

API: `http://localhost:8000/docs` (`POST /api/analyze`, `GET /api/analyses`, `GET /api/tasks`).
CLI: `tune analyze --task flood --input imagen.tif`.

Imágenes de prueba (GeoTIFF con las 6 bandas Prithvi): carpeta `examples/` de
[Sen1Floods11](https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M-TL-Sen1Floods11/tree/main/examples) y
[Burn Scars](https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M-BurnScars/tree/main/examples).

Frontend en caliente (opcional): `make web-dev` con la API corriendo en `:8000`.

Stack: FastAPI + TerraTorch/PyTorch (backend) · Vite + React + TypeScript + Leaflet (web) · Docker Compose.
Arquitectura: [docs/architecture/v2.md](./docs/architecture/v2.md).

## Laboratorio de fine‑tuning (secundario)

### Lab universidad (GPU) — un comando

```bash
cd ~/Desktop/Tune
git pull origin main
make lab-down
make lab-experiment    # Prithvi 2 epochs (perfil viernes)
```

Ver [docs/research/RevisionLab.md](./docs/research/RevisionLab.md).

### Smoke CPU (sin NVIDIA)

```bash
cp .env.example .env
docker compose --profile smoke build training-cpu
docker compose --profile smoke run --rm training-cpu \
  python scripts/prepare_data.py --name cifar10_smoke --version 1.0 --download-cpu-smoke
docker compose --profile smoke run --rm training-cpu tune run -s baseline -s optimized
docker compose --profile smoke down
```

Guía completa: [docs/research/ComoProbar.md](./docs/research/ComoProbar.md)

## Documentación

### Entregables (modelo de repositorio)

| Documento | Descripción |
|---|---|
| [docs/PrimerInforme.md](./docs/PrimerInforme.md) | Informe de planteamiento (**congelado 2026-08-29**) |
| [docs/SegundoInforme.md](./docs/SegundoInforme.md) | Guía / segundo informe |
| [docs/InformeFinal.md](./docs/InformeFinal.md) | Informe final |
| [docs/Instalación.md](./docs/Instalación.md) | Instalación |
| [docs/Desarrollo.md](./docs/Desarrollo.md) | Manual de desarrollo |

### Investigación y arquitectura (carpetas)

| Documento | Descripción |
|---|---|
| [docs/research/ComoProbar.md](./docs/research/ComoProbar.md) | Cómo probar (PC / free-tier / lab) |
| [docs/research/CaminoInmediato.md](./docs/research/CaminoInmediato.md) | Orden de avance |
| [docs/research/Investigacion.md](./docs/research/Investigacion.md) | Marco de investigación |
| [docs/research/plan.md](./docs/research/plan.md) | Plan de trabajo |
| [docs/architecture/v2.md](./docs/architecture/v2.md) | Arquitectura actual (app EO) |
| [docs/architecture/v1.md](./docs/architecture/v1.md) | Arquitectura v1 (laboratorio fine-tuning) |
| [docs/decisions/](./docs/decisions/) | ADRs |

Repo: https://github.com/Charlsz/Tune
