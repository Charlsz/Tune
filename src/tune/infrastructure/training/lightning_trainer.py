"""Facade del trainer: despacha según ``config.model.task``.

- classification → ClassificationTrainer (smoke CPU / Plan B)
- segmentation → pendiente (caso Burn Scars en GPU)
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
        raise NotImplementedError(
            f"Trainer para task='{config.model.task}' aún no implementado. "
            "El smoke local usa task=classification (ResNet18 preentrenado). "
            "Segmentación EO (Prithvi) se ejecuta en GPU free-tier/lab."
        )
