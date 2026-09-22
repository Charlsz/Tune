# Imagen de inferencia: núcleo + api + tracking. Sin torch por defecto; cuando el
# caso de estudio fije el runtime de inferencia (Fase 5) se agrega el extra
# `training` o una dependencia CPU-only de torch.
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Capa de dependencias (se cachea mientras no cambie pyproject.toml)
COPY pyproject.toml README.md LICENSE ./
COPY src ./src
RUN pip install --upgrade pip && pip install ".[api,tracking]"

COPY configs ./configs

# Usuario no root
RUN useradd --create-home --uid 1000 tune && chown -R tune:tune /app
USER tune

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "tune.interfaces.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
