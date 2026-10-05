# Tune

Aplicación de **análisis de imágenes satelitales** para detectar **inundaciones** y **cicatrices de incendio** con los modelos **Prithvi-EO 2.0** que IBM-NASA publicó fine-tuneados en Hugging Face. Subes un GeoTIFF (o eliges una escena Sentinel-2 por coordenada) y Tune muestra la máscara. En inundación, compara contra agua permanente (JRC / historial): inundación = agua nueva, no todo el agua.

No entrenamos: se usan checkpoints publicados ([ADR 005](./docs/decisions/005-app-inferencia-checkpoints-publicados.md)). Definición de cambio: [ADR 010](./docs/decisions/010-inundacion-como-cambio.md). El laboratorio de fine-tuning está en [`lab/`](./lab/README.md).

## App

```bash
cp .env.example .env
make app-up          # CPU  -> http://localhost:8080
make app-up-gpu      # NVIDIA
make app-logs        # la primera inferencia descarga ~1.2 GB de pesos
make piloto          # piloto La Mojana (API en :8000)
make app-down
```

Variables útiles: `TUNE_REFERENCE_JRC` (default true), `TUNE_JRC_PERMANENT_PCT` (75), `TUNE_CATALOG_MAX_KM` (30).

API: `http://localhost:8000/docs` (`POST /api/analyze`, `GET /api/catalog/search`, `GET /api/analyses`).
CLI: `tune analyze --task flood --input imagen.tif`.

Imágenes de prueba: ver [`examples/`](./examples/README.md). Piloto: [`docs/validation/piloto-la-mojana.md`](./docs/validation/piloto-la-mojana.md).

Frontend: `make web-dev` con la API en `:8000`.

Stack: FastAPI + TerraTorch (backend) · Vite + React (web) · Docker Compose.
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
