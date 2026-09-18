"""Despacho del trainer según ``config.model.task``.

- classification → ClassificationTrainer (smoke / Plan B)
- segmentation → SegmentationTrainer (Prithvi + Burn Scars vía TerraTorch)
"""

from __future__ import annotations

from tune.domain.entities import EfficiencyMetrics, TrainingConfig


class LightningTrainer:
    def __init__(self, artifacts_dir: str, data_dir: str = "data") -> None:
        self.artifacts_dir = artifacts_dir
        self.data_dir = data_dir

    def train(self, config: TrainingConfig) -> tuple[str, EfficiencyMetrics]:
        task = config.model.task.lower()
        if task == "classification":
            from tune.infrastructure.training.classification_trainer import (  # noqa: PLC0415
                ClassificationTrainer,
            )

            return ClassificationTrainer(self.artifacts_dir, self.data_dir).train(config)
        if task == "segmentation":
            from tune.infrastructure.training.segmentation_trainer import (  # noqa: PLC0415
                SegmentationTrainer,
            )

            return SegmentationTrainer(self.artifacts_dir, self.data_dir).train(config)
        raise NotImplementedError(
            f"Trainer para task='{config.model.task}' no implementado. "
            "Soportados: classification, segmentation."
        )
