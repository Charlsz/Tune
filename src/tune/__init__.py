"""Tune: laboratorio MLOps para fine-tuning eficiente.

Capas (de adentro hacia afuera, las dependencias solo apuntan hacia adentro):

- ``tune.domain``          entidades, reglas y puertos (interfaces). Sin frameworks.
- ``tune.application``     casos de uso = stages del pipeline. Orquestan puertos.
- ``tune.infrastructure``  adaptadores concretos: MLflow, PyTorch/Lightning, YAML, FS.
- ``tune.interfaces``      puntos de entrada: CLI (typer) y API (FastAPI).
"""

__version__ = "0.1.0"
