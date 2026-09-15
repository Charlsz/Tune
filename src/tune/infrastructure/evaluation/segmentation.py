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
        raise NotImplementedError(
            f"Evaluator para task='{config.model.task}' aún no implementado "
            "(segmentación EO pendiente de GPU)."
        )


# Compat: imports antiguos
class SegmentationEvaluator:
    primary_metric = "miou"

    def evaluate(self, checkpoint_uri: str, config: TrainingConfig) -> QualityMetrics:
        raise NotImplementedError(
            "SegmentationEvaluator: caso Burn Scars en GPU. "
            "Para smoke local usa task=classification."
        )
