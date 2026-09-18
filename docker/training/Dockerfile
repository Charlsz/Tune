# Imagen de entrenamiento: PyTorch + CUDA + el paquete tune en modo editable
# (el código se monta como volumen en docker-compose para iterar sin rebuild).
FROM pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Labs universitarios a menudo tienen el reloj desfasado; apt entonces falla con
# "Release file ... is not valid yet". Desactivamos la validación de fecha del índice.
RUN printf '%s\n' \
      'Acquire::Check-Valid-Until "false";' \
      'Acquire::Check-Date "false";' \
      > /etc/apt/apt.conf.d/99tune-clock \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
      git \
      libgdal-dev \
      gdal-bin \
      libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md LICENSE ./
COPY src ./src
# torch ya viene en la base; pip lo detecta y no lo reinstala.
RUN pip install --upgrade pip && pip install -e ".[training,tracking]"

COPY configs ./configs

VOLUME ["/app/data", "/app/artifacts"]

ENTRYPOINT []
CMD ["tune", "--help"]
