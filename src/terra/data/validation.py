"""Dataset layout validation."""

from __future__ import annotations

from pathlib import Path


def validate_burn_scars_layout(data_root: Path) -> list[str]:
    """Return validation errors for HLS Burn Scars layout; empty if valid."""
    errors: list[str] = []
    required = [
        data_root / "data",
        data_root / "splits" / "train.txt",
        data_root / "splits" / "val.txt",
        data_root / "splits" / "test.txt",
    ]
    for path in required:
        if not path.exists():
            errors.append(f"Missing: {path}")
    return errors
