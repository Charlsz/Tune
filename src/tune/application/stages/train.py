"""Stage ``train``: entrena una estrategia y deja la corrida trazada en el tracker."""

from __future__ import annotations

from dataclasses import asdict, dataclass

from tune.domain.entities import TrainingConfig
from tune.domain.ports import ExperimentTracker, Trainer


@dataclass
class TrainStage:
    trainer: Trainer
    tracker: ExperimentTracker

    def execute(self, config: TrainingConfig) -> str:
        """Devuelve el ``run_id`` del tracker."""
        run_id = self.tracker.start_run(
            name=f"train-{config.strategy.value}",
            tags={"strategy": config.strategy.value, "stage": "train"},
        )
        try:
            self.tracker.log_params(run_id, _flatten(asdict(config)))
            checkpoint_uri, efficiency = self.trainer.train(config)
            self.tracker.log_metrics(
                run_id,
                {
                    "train_time_s": efficiency.train_time_s,
                    "peak_gpu_memory_mb": efficiency.peak_gpu_memory_mb or 0.0,
                    "gpu_hours": efficiency.gpu_hours or 0.0,
                },
            )
            self.tracker.log_params(
                run_id, {"hardware": efficiency.hardware, "checkpoint_uri": checkpoint_uri}
            )
            return run_id
        finally:
            self.tracker.end_run(run_id)


def _flatten(d: dict, prefix: str = "") -> dict[str, object]:
    out: dict[str, object] = {}
    for k, v in d.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(_flatten(v, f"{key}."))
        else:
            out[key] = v.value if hasattr(v, "value") else v
    return out
