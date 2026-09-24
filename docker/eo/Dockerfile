# Imagen ML: PyTorch + CUDA + terratorch + el paquete tune en modo editable.
# La usan `eo-api` (app) y `lab` training (fine-tune). Código montado como volumen.
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
# pip más nuevo que 24.2 rompe site.py en esta imagen (traceback.format_exception).
# editable_mode=compat evita el .pth con importador que dispara ese fallo.
RUN python -m pip install --upgrade "pip==24.2" \
 && python -m pip install --config-settings editable_mode=compat -e ".[training,tracking,api]"

VOLUME ["/app/data", "/app/artifacts"]

ENTRYPOINT []
CMD ["tune", "--help"]
