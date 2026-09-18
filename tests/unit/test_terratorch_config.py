"""Tests del generador de YAML TerraTorch (sin GPU ni terratorch)."""

from __future__ import annotations

from pathlib import Path

from tune.domain.entities import DatasetSpec, ModelSpec, Strategy, TrainingConfig
from tune.infrastructure.training.terratorch_config import (
    freeze_backbone_for,
    map_precision,
    write_terratorch_yaml,
)


def _cfg(**extra) -> TrainingConfig:
    return TrainingConfig(
        strategy=Strategy.BASELINE,
        dataset=DatasetSpec(name="hls_burn_scars", version="1.0", root="hls_burn_scars/1.0"),
        model=ModelSpec(
            name="prithvi-eo-2.0-300m",
            source="ibm-nasa-geospatial/Prithvi-EO-2.0-300M",
            task="segmentation",
        ),
        epochs=1,
        batch_size=2,
        precision="32",
        peft=None,
        extra=extra,
    )


def test_freeze_backbone_baseline_false():
    assert freeze_backbone_for(_cfg()) is False


def test_freeze_backbone_optimized_true():
    cfg = TrainingConfig(
        strategy=Strategy.OPTIMIZED,
        dataset=DatasetSpec(name="hls_burn_scars", version="1.0", root="hls_burn_scars/1.0"),
        model=ModelSpec(
            name="prithvi",
            source="ibm-nasa-geospatial/Prithvi-EO-2.0-300M",
            task="segmentation",
        ),
        peft={"method": "lora"},
    )
    assert freeze_backbone_for(cfg) is True


def test_map_precision():
    assert map_precision("16-mixed") == "16-mixed"
    assert map_precision("32") == "32-true"


def test_write_terratorch_yaml(tmp_path: Path):
    data_root = tmp_path / "hls_burn_scars" / "1.0"
    (data_root / "data").mkdir(parents=True)
    (data_root / "splits").mkdir(parents=True)
    out = write_terratorch_yaml(
        _cfg(limit_train_batches=4),
        data_root=data_root,
        default_root_dir=tmp_path / "run",
        out_path=tmp_path / "tt.yaml",
    )
    text = out.read_text(encoding="utf-8")
    assert "prithvi_eo_v2_300" in text
    assert "SemanticSegmentationTask" in text
    assert "limit_train_batches" in text
