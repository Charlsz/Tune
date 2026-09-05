"""Carga ``configs/training/<strategy>.yaml`` y ``configs/pipeline/thresholds.yaml``."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from tune.domain.entities import (
    DatasetSpec,
    ModelSpec,
    PromotionThresholds,
    Strategy,
    TrainingConfig,
)


class YamlConfigRepository:
    def __init__(self, configs_dir: Path) -> None:
        self.configs_dir = Path(configs_dir)

    def load_training_config(self, strategy: str) -> TrainingConfig:
        raw = self._read(self.configs_dir / "training" / f"{strategy}.yaml")
        return parse_training_config(raw, strategy)

    def load_thresholds(self) -> PromotionThresholds:
        raw = self._read(self.configs_dir / "pipeline" / "thresholds.yaml")
        return PromotionThresholds(
            min_primary_metric=float(raw["min_primary_metric"]),
            max_quality_drop_vs_baseline=raw.get("max_quality_drop_vs_baseline"),
        )

    @staticmethod
    def _read(path: Path) -> dict[str, Any]:
        if not path.exists():
            raise FileNotFoundError(f"Config no encontrada: {path}")
        with path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
        if not isinstance(data, dict):
            raise ValueError(f"La config {path} debe ser un mapeo YAML")
        return data


def parse_training_config(raw: dict[str, Any], strategy: str) -> TrainingConfig:
    """Traduce el YAML plano a la entidad del dominio. Falla temprano si falta algo."""
    try:
        ds, model, train = raw["dataset"], raw["model"], raw["training"]
    except KeyError as exc:
        raise ValueError(f"Falta la sección {exc} en la config '{strategy}'") from exc

    return TrainingConfig(
        strategy=Strategy(raw.get("strategy", strategy)),
        dataset=DatasetSpec(
            name=ds["name"],
            version=str(ds["version"]),
            root=ds["root"],
            splits=tuple(ds.get("splits", ("train", "val", "test"))),
        ),
        model=ModelSpec(name=model["name"], source=model["source"], task=model["task"]),
        seed=int(train.get("seed", 42)),
        epochs=int(train.get("epochs", 1)),
        batch_size=int(train.get("batch_size", 8)),
        learning_rate=float(train.get("learning_rate", 1e-4)),
        precision=str(train.get("precision", "32")),
        peft=raw.get("peft"),
        extra=raw.get("extra", {}),
    )
