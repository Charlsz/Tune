# Imagen ML: PyTorch + CUDA + terratorch + el paquete tune en modo editable.
# La usan `eo-api` (app) y `lab` training (fine-tune). Código montado como volumen.
FROM pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

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

# Dependencias antes que el código: cambiar src/ no invalida esta capa.
# El paquete vacío basta para la instalación editable (apunta a /app/src).
# La caché de pip sobrevive entre builds aunque cambie pyproject.toml.
# torch/torchvision quedan fijos en los de la base para no bajar otra CUDA (~2 GB).
COPY pyproject.toml README.md LICENSE ./
RUN --mount=type=cache,target=/root/.cache/pip \
    mkdir -p src/tune && touch src/tune/__init__.py \
    && python -c "import torch, torchvision; \
print(f'torch=={torch.__version__}'); print(f'torchvision=={torchvision.__version__}')" \
       > /tmp/base-torch.txt \
    && python -m pip install -c /tmp/base-torch.txt -e ".[training,tracking,api]"
COPY src ./src

VOLUME ["/app/data", "/app/artifacts"]

ENTRYPOINT []
CMD ["tune", "--help"]
