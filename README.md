# Tune

Aplicación de **análisis de imágenes satelitales** para detectar **inundaciones** y **cicatrices de incendio** con los modelos **Prithvi‑EO 2.0** que IBM‑NASA publicó fine‑tuneados en Hugging Face. Subes un GeoTIFF, Tune corre el modelo y muestra la máscara sobre un mapa.

No entrenamos: se usan checkpoints publicados ([ADR 005](./docs/decisions/005-app-inferencia-checkpoints-publicados.md)). El laboratorio de fine‑tuning está en [`lab/`](./lab/README.md).

## App

```bash
cp .env.example .env
make app-up          # CPU  -> http://localhost:8080
make app-up-gpu      # NVIDIA
make app-logs        # la primera inferencia descarga ~1.2 GB de pesos
make app-down
```

API: `http://localhost:8000/docs` (`POST /api/analyze`, `GET /api/analyses`, `GET /api/tasks`).
CLI: `tune analyze --task flood --input imagen.tif`.

Imágenes de prueba: ver [`examples/`](./examples/README.md).

Frontend: `make web-dev` con la API en `:8000`.

Stack: FastAPI + TerraTorch (backend) · Vite + React + Leaflet (web) · Docker Compose.
Arquitectura: [docs/architecture/v2.md](./docs/architecture/v2.md).

## Documentación

| Documento | Qué es |
|---|---|
| [docs/SegundoInforme.md](./docs/SegundoInforme.md) | Segundo informe (avance actual) |
| [docs/PrimerInforme.md](./docs/PrimerInforme.md) | Planteamiento original (**congelado 2026-08-29**) |
| [docs/Instalación.md](./docs/Instalación.md) | Cómo instalar y levantar la app |
| [docs/Desarrollo.md](./docs/Desarrollo.md) | Cómo tocar el código |
| [docs/decisions/](./docs/decisions/) | ADRs |
| [lab/README.md](./lab/README.md) | Fine-tuning (secundario) |

## Estudiantes

| Nombre | GitHub |
|---|---|
| Carlos Andrés Galvis Pájaro | [@Charlsz](https://github.com/Charlsz) |
| Zenen Contreras Royero | [@zenencontreras](https://github.com/zenencontreras) |

## Tutores

- Daniel Romero

Repo: https://github.com/Charlsz/Tune
