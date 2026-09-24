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
# torch ya viene en la base; no reinstalarlo.
# Algunos .pth de conda ejecutan "import ..." al arrancar. Si esa linea falla,
# site.py muere reportando traceback.format_exception. Se borran solo esos
# .pth (los que agregan rutas, como los de torch, se quedan).
# PYTHONSAFEPATH y /tmp evitan que /app tape modulos de la stdlib.
ENV PYTHONSAFEPATH=1
RUN find /opt/conda -name '*.pth' -print -exec grep -H . {} \; \
 && find /opt/conda -name '*.pth' -print0 \
    | xargs -0 grep -l '^import' \
    | xargs -r rm -fv \
 && cd /tmp \
 && /opt/conda/bin/python -c "import traceback, types; assert hasattr(traceback, 'format_exception'); assert hasattr(types, 'GenericAlias')" \
 && /opt/conda/bin/python -m pip install --config-settings editable_mode=compat -e "/app[training,tracking,api]"

VOLUME ["/app/data", "/app/artifacts"]

ENTRYPOINT []
CMD ["tune", "--help"]
