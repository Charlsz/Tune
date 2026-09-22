# Instalación — Tune (aplicación)

**Proyecto:** análisis de imágenes satelitales (inundación / cicatriz) con checkpoints Prithvi-EO 2.0 publicados.

El laboratorio de fine-tuning (opcional) está documentado en [lab/README.md](../lab/README.md).

## 1. Qué se instala

El paquete `tune` (CLI `tune analyze` + API `/api`) y, con Docker, el frontend en el puerto 8080. El extra `[training]` trae TerraTorch/PyTorch para inferir; Docker ya lo incluye.

## 2. Requisitos

- Git, Docker + Docker Compose (camino recomendado)
- Opcional: Python 3.11, Node 22 (desarrollo del frontend)
- GPU NVIDIA opcional (`make app-up-gpu`); CPU basta para la demo

## 3. Docker (recomendado)

```bash
git clone https://github.com/Charlsz/Tune.git
cd Tune
cp .env.example .env
make app-up
# Web  http://localhost:8080
# API  http://localhost:8000/docs
```

La primera inferencia descarga ~1,2 GB de pesos (caché en el volumen `hf-cache`). Escenas de prueba: [examples/README.md](../examples/README.md).

Apagar: `make app-down`.

## 4. Instalación local (desarrollo)

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -U pip
pip install -e ".[api,dev]"
cp .env.example .env
pytest -q
tune --help
```

API sin Docker (hace falta el extra `training` para Prithvi):

```bash
pip install -e ".[api,training,dev]"
uvicorn tune.interfaces.api.main:app --reload
```

Frontend: `make web-dev` (Vite en `:5173`, espera la API en `:8000`).

## 5. Verificación rápida

| Chequeo | Comando / URL | OK si… |
|---------|---------------|--------|
| Tests | `pytest -q` | pasan (sin GPU) |
| CLI | `tune analyze --help` | documenta `--task` / `--input` |
| App | `make app-up` | mapa en `:8080`, OpenAPI en `:8000/docs` |
| Compose | `docker compose config -q` | sin error (tras `.env`) |

## 6. Solución de problemas

| Síntoma | Qué hacer |
|---------|-----------|
| `No module named tune` | `pip install -e ".[api,dev]"` desde la raíz |
| `docker compose` pide `.env` | `cp .env.example .env` |
| Inferencia 503 / falta terratorch | usar `make app-up` o extra `training` |
| Raster 422 | GeoTIFF con 6 bandas Prithvi (o L1C en inundación) |
| Overlay sin mapa | el GeoTIFF no trae CRS |

## 7. Laboratorio de fine-tuning

No forma parte de esta instalación. Ver [lab/README.md](../lab/README.md) y [lab/docs/research/ComoProbar.md](../lab/docs/research/ComoProbar.md).

## 8. Referencias

- [Desarrollo.md](./Desarrollo.md)
- [architecture/v2.md](./architecture/v2.md)
- [ADR 005](./decisions/005-app-inferencia-checkpoints-publicados.md)
