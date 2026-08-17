#!/usr/bin/env python3
"""Prepare the HLS Burn Scars dataset for Terra fine-tuning.

See data/README.md for download instructions and expected layout.

Usage:
    python scripts/prepare_data.py
    python scripts/prepare_data.py --data-root data/hls_burn_scars
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from terra.data.validation import validate_burn_scars_layout


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate and prepare Terra dataset layout.")
    parser.add_argument(
        "--data-root",
        type=Path,
        default=Path("data/hls_burn_scars"),
        help="Root directory for the HLS Burn Scars dataset",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    errors = validate_burn_scars_layout(args.data_root)

    if errors:
        print("Dataset layout validation failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        print("\nDownload instructions: data/README.md", file=sys.stderr)
        return 1

    print(f"Dataset layout OK: {args.data_root.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
