"""Fixtures compartidas. Sin GPU, sin MLflow real: todo con fakes en memoria."""

from __future__ import annotations

from pathlib import Path

import pytest

from tune.domain.entities import (
    DatasetSpec,
    EfficiencyMetrics,
    ModelSpec,
    QualityMetrics,
    RunResult,
    Strategy,
    TrainingConfig,
)

REPO_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def configs_dir() -> Path:
    return REPO_ROOT / "configs"


@pytest.fixture
def training_config() -> TrainingConfig:
    return TrainingConfig(
        strategy=Strategy.BASELINE,
        dataset=DatasetSpec(name="toy", version="1", root="toy/1"),
        model=ModelSpec(name="toy-model", source="local", task="segmentation"),
    )


def make_run(run_id: str, miou: float, time_s: float, config: TrainingConfig) -> RunResult:
    return RunResult(
        run_id=run_id,
        config=config,
        efficiency=EfficiencyMetrics(
            train_time_s=time_s, peak_gpu_memory_mb=1000.0, gpu_hours=time_s / 3600, hardware="T4"
        ),
        quality=QualityMetrics(values={"miou": miou, "f1": miou + 0.05}, primary="miou"),
        checkpoint_uri=f"file:///tmp/{run_id}.ckpt",
    )


class FakeTracker:
    """ExperimentTracker en memoria."""

    def __init__(self, runs: dict[str, RunResult] | None = None) -> None:
        self.runs = runs or {}
        self.params: dict[str, dict] = {}
        self.metrics: dict[str, dict] = {}
        self.ended: list[str] = []
        self._n = 0

    def start_run(self, name: str, tags=None) -> str:
        self._n += 1
        return f"run-{self._n}"

    def log_params(self, run_id, params):
        self.params.setdefault(run_id, {}).update(params)

    def log_metrics(self, run_id, metrics, step=None):
        self.metrics.setdefault(run_id, {}).update(metrics)

    def log_artifact(self, run_id, local_path):
        pass

    def end_run(self, run_id):
        self.ended.append(run_id)

    def get_run(self, run_id) -> RunResult:
        return self.runs[run_id]


class FakeRegistry:
    def __init__(self) -> None:
        self.versions: list[tuple[str, str]] = []
        self.stages: list[tuple[str, str, str]] = []

    def register(self, run, model_name) -> str:
        self.versions.append((model_name, run.run_id))
        return str(len(self.versions))

    def set_stage(self, model_name, version, stage):
        self.stages.append((model_name, version, stage.value))

    def resolve(self, model_name, alias) -> str:
        return f"models:/{model_name}@{alias}#1"
