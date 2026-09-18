"""Evaluators por tarea. Despacho según ``config.model.task``."""

from __future__ import annotations

from tune.domain.entities import QualityMetrics, TrainingConfig


class TaskEvaluator:
    def __init__(self, data_dir: str = "data") -> None:
        self.data_dir = data_dir

    def evaluate(self, checkpoint_uri: str, config: TrainingConfig) -> QualityMetrics:
        task = config.model.task.lower()
        if task == "classification":
            from tune.infrastructure.training.classification_trainer import (  # noqa: PLC0415
                ClassificationEvaluator,
            )

            return ClassificationEvaluator(self.data_dir).evaluate(checkpoint_uri, config)
        if task == "segmentation":
            from tune.infrastructure.training.segmentation_trainer import (  # noqa: PLC0415
                SegmentationEvaluator,
            )

            return SegmentationEvaluator(self.data_dir).evaluate(checkpoint_uri, config)
        raise NotImplementedError(
            f"Evaluator para task='{config.model.task}' no implementado. "
            "Soportados: classification, segmentation."
        )


# Compat: imports antiguos
class SegmentationEvaluator:
    primary_metric = "miou"

    def __init__(self, data_dir: str = "data") -> None:
        self.data_dir = data_dir

    def evaluate(self, checkpoint_uri: str, config: TrainingConfig) -> QualityMetrics:
        return TaskEvaluator(self.data_dir).evaluate(checkpoint_uri, config)
