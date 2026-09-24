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
# Un .pth de conda ejecuta "import ..." al arrancar Python. Si esa linea falla,
# site.py intenta reportarlo con traceback.format_exception y el proceso muere
# (el modulo traceback que encuentra no es el de la stdlib). Se borran esos
# .pth y pip se lanza con python -S, que no carga site.py.
ENV PYTHONSAFEPATH=1
RUN find /opt/conda -name '*.pth' -print -exec grep -H . {} \; \
 && find /opt/conda -name '*.pth' -print0 \
    | xargs -0 grep -l '^import' \
    | xargs -r rm -fv \
 && PY_SITE="$(echo /opt/conda/lib/python3.*/site-packages)" \
 && cd /tmp \
 && /opt/conda/bin/python -S -c "import sys,runpy; sys.path.insert(0, '${PY_SITE}'); sys.argv=['pip','install','--config-settings','editable_mode=compat','-e','/app[training,tracking,api]']; runpy.run_module('pip', run_name='__main__')"

VOLUME ["/app/data", "/app/artifacts"]

ENTRYPOINT []
CMD ["tune", "--help"]
