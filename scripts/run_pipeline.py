#!/usr/bin/env python3
"""End-to-end Terra MLOps pipeline.

Stages (see docs/decisions/002-orchestration.md):
    prepare → train → evaluate → register

Usage:
    python scripts/run_pipeline.py --stage prepare
    python scripts/run_pipeline.py --stage all --config configs/training/burn_scars.yaml

Implementation: Fase 3 of docs/plan.md
"""

from __future__ import annotations

import argparse
from pathlib import Path

STAGES = ("prepare", "train", "evaluate", "register", "all")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Terra MLOps pipeline stages.")
    parser.add_argument(
        "--stage",
        choices=STAGES,
        required=True,
        help="Pipeline stage to execute",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("configs/training/burn_scars.yaml"),
        help="TerraTorch training configuration",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    print(f"Pipeline stage '{args.stage}' is not implemented yet.")
    print("See docs/plan.md — Fase 3: Pipeline automatizado.")
    print(f"Config: {args.config}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
