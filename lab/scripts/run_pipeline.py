"""Punto de entrada del pipeline (ADR 002). Delegado a la CLI ``tune``.

    python scripts/run_pipeline.py run --strategy baseline --strategy optimized
    python scripts/run_pipeline.py train --strategy optimized

Equivalente a ejecutar ``tune ...`` tras ``pip install -e .``.
"""

from tune.interfaces.cli.main import app

if __name__ == "__main__":
    app()
