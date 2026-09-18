"""Genera YAML TerraTorch a partir de ``TrainingConfig`` (caso Burn Scars / Prithvi).

Tune no inventa el modelo: usa el backbone ``prithvi_eo_v2_300`` preentrenado
(HF ``ibm-nasa-geospatial/Prithvi-EO-2.0-300M``) vía TerraTorch, la vía oficial
de fine-tuning documentada por IBM–NASA.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from tune.domain.entities import TrainingConfig

# Bands / normalización del paper Prithvi-EO-2.0 Burn Scars (HF model card).
_BANDS = ["BLUE", "GREEN", "RED", "NIR_NARROW", "SWIR_1", "SWIR_2"]
_MEANS = [
    0.033349706741586264,
    0.05701185520536176,
    0.05889748132001316,
    0.2323245113436119,
    0.1972854853760658,
    0.11944914225186566,
]
_STDS = [
    0.02269135568823774,
    0.026807560223070237,
    0.04004109844362779,
    0.07791732423672691,
    0.08708738838140137,
    0.07241979477437814,
]


def freeze_backbone_for(config: TrainingConfig) -> bool:
    """Baseline = full FT; optimized / PEFT = congelar backbone (decoder trainable)."""
    if config.peft is None and not bool(config.extra.get("freeze_backbone", False)):
        return False
    return True


def map_precision(precision: str) -> str:
    p = precision.strip().lower()
    if p in {"16", "16-mixed", "fp16"}:
        return "16-mixed"
    if p in {"bf16", "bf16-mixed"}:
        return "bf16-mixed"
    return "32-true"


def build_terratorch_dict(
    config: TrainingConfig,
    *,
    data_root: Path,
    default_root_dir: Path,
) -> dict[str, Any]:
    """Estructura compatible con ``terratorch fit -c`` / LightningCLI."""
    root = Path(data_root)
    # Layout Tune: data/<name>/<version>/{data,splits} tras --download-burn-scars
    geo_root = root
    data_dir = geo_root / "data"
    splits_dir = geo_root / "splits"
    if not data_dir.is_dir():
        # compat: archivos planos bajo el root versionado
        data_dir = geo_root
        splits_dir = geo_root / "splits"

    freeze = freeze_backbone_for(config)
    patience = int(config.extra.get("early_stopping_patience", 5))
    num_workers = int(config.extra.get("num_workers", 4))
    limit_train = config.extra.get("limit_train_batches")
    limit_val = config.extra.get("limit_val_batches")
    limit_test = config.extra.get("limit_test_batches")

    trainer: dict[str, Any] = {
        "accelerator": "auto",
        "devices": 1,
        "max_epochs": int(config.epochs),
        "log_every_n_steps": 1,
        "default_root_dir": str(default_root_dir),
        "enable_checkpointing": True,
        "precision": map_precision(config.precision),
        "callbacks": [
            {
                "class_path": "lightning.pytorch.callbacks.EarlyStopping",
                "init_args": {
                    "monitor": "val/loss",
                    "patience": patience,
                },
            },
            {
                "class_path": "lightning.pytorch.callbacks.ModelCheckpoint",
                "init_args": {
                    "monitor": "val/loss",
                    "mode": "min",
                    "save_top_k": 1,
                    "filename": f"tune-{config.strategy.value}-{{epoch}}-{{val/loss:.4f}}",
                },
            },
        ],
    }
    if limit_train is not None:
        trainer["limit_train_batches"] = float(limit_train)
    if limit_val is not None:
        trainer["limit_val_batches"] = float(limit_val)
    if limit_test is not None:
        trainer["limit_test_batches"] = float(limit_test)

    return {
        "seed_everything": int(config.seed),
        "trainer": trainer,
        "model": {
            "class_path": "terratorch.tasks.SemanticSegmentationTask",
            "init_args": {
                "model_factory": "EncoderDecoderFactory",
                "model_args": {
                    "backbone": "prithvi_eo_v2_300",
                    "backbone_pretrained": True,
                    "backbone_bands": list(_BANDS),
                    "necks": [
                        {"name": "SelectIndices", "indices": [5, 11, 17, 23]},
                        {"name": "ReshapeTokensToImage"},
                        {"name": "LearnedInterpolateToPyramidal"},
                    ],
                    "decoder": "UNetDecoder",
                    "decoder_channels": [512, 256, 128, 64],
                    "num_classes": 2,
                },
                "loss": "ce",
                "ignore_index": -1,
                "freeze_backbone": freeze,
                "plot_on_val": False,
                "class_names": ["Not burned", "Burn scar"],
            },
        },
        "optimizer": {
            "class_path": "torch.optim.AdamW",
            "init_args": {"lr": float(config.learning_rate)},
        },
        "lr_scheduler": {
            "class_path": "torch.optim.lr_scheduler.ReduceLROnPlateau",
            "init_args": {
                "monitor": "val/loss",
                "factor": 0.5,
                "patience": max(2, patience // 2),
            },
        },
        "data": {
            "class_path": "terratorch.datamodules.GenericNonGeoSegmentationDataModule",
            "init_args": {
                "batch_size": int(config.batch_size),
                "num_workers": num_workers,
                "dataset_bands": list(_BANDS),
                "output_bands": list(_BANDS),
                "rgb_indices": [2, 1, 0],
                "train_data_root": str(data_dir),
                "val_data_root": str(data_dir),
                "test_data_root": str(data_dir),
                "train_split": str(splits_dir / "train.txt"),
                "val_split": str(splits_dir / "val.txt"),
                "test_split": str(splits_dir / "test.txt"),
                "img_grep": "*_merged.tif",
                "label_grep": "*.mask.tif",
                "means": list(_MEANS),
                "stds": list(_STDS),
                "num_classes": 2,
                "train_transform": [
                    {"class_path": "albumentations.D4"},
                    {"class_path": "ToTensorV2"},
                ],
                "test_transform": [{"class_path": "ToTensorV2"}],
                "no_data_replace": 0,
                "no_label_replace": -1,
            },
        },
    }


def write_terratorch_yaml(
    config: TrainingConfig,
    *,
    data_root: Path,
    default_root_dir: Path,
    out_path: Path,
) -> Path:
    payload = build_terratorch_dict(config, data_root=data_root, default_root_dir=default_root_dir)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        yaml.safe_dump(payload, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    return out_path
