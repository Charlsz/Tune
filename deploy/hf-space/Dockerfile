# Tune en Hugging Face Spaces (Docker, free tier cpu-basic).
# Un solo contenedor: FastAPI + frontend Vite en el puerto 7860.
# Build context = raíz del staging (ver scripts/deploy_hf_space.py).

FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --ignore-scripts
COPY web/ ./
RUN npm run build

FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.hf_cache \
    TUNE_ARTIFACTS_DIR=/app/artifacts \
    TUNE_WEB_DIST=/app/web/dist \
    TUNE_TRACKER=json \
    TUNE_DEVICE=cpu \
    TUNE_CORS_ORIGINS=* \
    OMP_NUM_THREADS=2 \
    MKL_NUM_THREADS=2 \
    PORT=7860

WORKDIR /app

# GDAL/rasterio + curl para healthchecks del Space.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        curl \
        libgdal-dev \
        gdal-bin \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md LICENSE ./
COPY src ./src

# Torch CPU primero; luego API + training (Prithvi vía terratorch).
RUN pip install --upgrade pip \
    && pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install -e ".[api,training]"

# Frontend estático (misma origen que /api).
COPY --from=web /web/dist /app/web/dist

# Demos sembradas: la UI muestra resultados sin esperar la 1ª inferencia.
COPY artifacts/analyses /app/artifacts/analyses
COPY examples /app/examples

# Prefetch del checkpoint de inundación (público) para cold start usable en CPU.
COPY prefetch_flood_model.py /tmp/prefetch_flood_model.py
RUN python /tmp/prefetch_flood_model.py && rm /tmp/prefetch_flood_model.py

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["sh", "-c", "uvicorn tune.interfaces.api.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
