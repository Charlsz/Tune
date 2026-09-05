"""Stage ``compare``: confronta dos corridas ya trackeadas (baseline vs optimized)."""

from __future__ import annotations

from dataclasses import dataclass

from tune.domain.entities import ComparisonResult
from tune.domain.ports import ExperimentTracker


@dataclass
class CompareStage:
    tracker: ExperimentTracker

    def execute(self, baseline_run_id: str, optimized_run_id: str) -> ComparisonResult:
        return ComparisonResult(
            baseline=self.tracker.get_run(baseline_run_id),
            optimized=self.tracker.get_run(optimized_run_id),
        )
