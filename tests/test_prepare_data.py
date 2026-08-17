"""Tests for dataset validation."""

from pathlib import Path

from terra.data.validation import validate_burn_scars_layout


def test_validate_layout_missing_dataset(tmp_path: Path) -> None:
    errors = validate_burn_scars_layout(tmp_path / "hls_burn_scars")
    assert len(errors) > 0
    assert any("Missing" in e for e in errors)


def test_validate_layout_complete_dataset(tmp_path: Path) -> None:
    root = tmp_path / "hls_burn_scars"
    (root / "data").mkdir(parents=True)
    splits = root / "splits"
    splits.mkdir()
    for name in ("train.txt", "val.txt", "test.txt"):
        (splits / name).write_text("", encoding="utf-8")

    errors = validate_burn_scars_layout(root)
    assert errors == []
