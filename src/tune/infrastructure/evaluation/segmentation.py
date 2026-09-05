"""``Evaluator`` para segmentación (caso preferido: HLS Burn Scars). Esqueleto."""

from __future__ import annotations

from tune.domain.entities import QualityMetrics, TrainingConfig


class SegmentationEvaluator:
    primary_metric = "miou"

    def evaluate(self, checkpoint_uri: str, config: TrainingConfig) -> QualityMetrics:
        # TODO(fase 1): cargar checkpoint, iterar el split test y calcular
        # IoU, mIoU, F1, precision y recall.
        raise NotImplementedError("SegmentationEvaluator.evaluate se implementa en la Fase 1")
