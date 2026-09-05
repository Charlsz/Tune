"""Stage ``evaluate``: métricas de calidad sobre el mismo test set para toda estrategia."""

from __future__ import annotations

from dataclasses import dataclass

from tune.domain.entities import QualityMetrics, TrainingConfig
from tune.domain.ports import Evaluator, ExperimentTracker


@dataclass
class EvaluateStage:
    evaluator: Evaluator
    tracker: ExperimentTracker

    def execute(self, run_id: str, config: TrainingConfig) -> QualityMetrics:
        run = self.tracker.get_run(run_id)
        quality = self.evaluator.evaluate(run.checkpoint_uri, config)
        self.tracker.log_metrics(run_id, {f"test_{k}": v for k, v in quality.values.items()})
        return quality
