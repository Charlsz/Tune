"""``Trainer`` con PyTorch Lightning. Esqueleto: la lógica del caso llega en Fase 1."""

from __future__ import annotations

from tune.domain.entities import EfficiencyMetrics, TrainingConfig


class LightningTrainer:
    def __init__(self, artifacts_dir: str) -> None:
        self.artifacts_dir = artifacts_dir

    def train(self, config: TrainingConfig) -> tuple[str, EfficiencyMetrics]:
        # TODO(fase 1): DataModule del caso, LightningModule, callbacks (early stopping,
        # checkpoint), y `tune.infrastructure.training.instrumentation` para medir
        # tiempo/memoria. Fase 3: aplicar `config.peft` y `config.precision`.
        raise NotImplementedError(
            f"LightningTrainer.train({config.strategy.value}) se implementa en la Fase 1"
        )
