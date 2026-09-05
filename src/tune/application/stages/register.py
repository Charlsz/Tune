"""Stage ``register``: aplica thresholds y promueve o rechaza en el Model Registry."""

from __future__ import annotations

from dataclasses import dataclass

from tune.domain.entities import PromotionStage, PromotionThresholds, QualityMetrics
from tune.domain.policies import decide_promotion
from tune.domain.ports import ExperimentTracker, ModelRegistry


@dataclass
class RegisterStage:
    registry: ModelRegistry
    tracker: ExperimentTracker
    model_name: str

    def execute(
        self,
        run_id: str,
        thresholds: PromotionThresholds,
        baseline_quality: QualityMetrics | None = None,
    ) -> PromotionStage:
        run = self.tracker.get_run(run_id)
        decision = decide_promotion(run.quality, thresholds, baseline_quality)
        if decision is PromotionStage.REJECTED:
            return decision

        version = self.registry.register(run, self.model_name)
        self.registry.set_stage(self.model_name, version, PromotionStage.EVALUATED)
        self.registry.set_stage(self.model_name, version, decision)
        return decision
