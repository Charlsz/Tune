"""Los stages orquestan puertos; se prueban con fakes, sin GPU ni MLflow."""

import pytest

from tests.conftest import FakeRegistry, FakeTracker, make_run
from tune.application.stages import CompareStage, PrepareStage, RegisterStage, TrainStage
from tune.domain.entities import EfficiencyMetrics, PromotionStage, PromotionThresholds


class FakeTrainer:
    def train(self, config):
        return "file:///ckpt", EfficiencyMetrics(12.0, 512.0, 12.0 / 3600, "T4")


class FakeDatasets:
    def __init__(self, ok=True):
        self.ok = ok

    def validate(self, spec):
        if not self.ok:
            raise ValueError("faltan splits")


def test_prepare_propagates_validation_error(training_config):
    with pytest.raises(ValueError):
        PrepareStage(FakeDatasets(ok=False)).execute(training_config.dataset)


def test_train_logs_params_metrics_and_closes_run(training_config):
    tracker = FakeTracker()
    run_id = TrainStage(FakeTrainer(), tracker).execute(training_config)

    assert run_id in tracker.ended
    assert tracker.params[run_id]["strategy"] == "baseline"
    assert tracker.params[run_id]["dataset.name"] == "toy"
    assert tracker.metrics[run_id]["train_time_s"] == 12.0


def test_register_promotes_to_candidate(training_config):
    run = make_run("r1", miou=0.8, time_s=100, config=training_config)
    tracker, registry = FakeTracker({"r1": run}), FakeRegistry()

    decision = RegisterStage(registry, tracker, "tune-model").execute(
        "r1", PromotionThresholds(min_primary_metric=0.6)
    )

    assert decision is PromotionStage.CANDIDATE
    assert [s[2] for s in registry.stages] == ["evaluated", "candidate"]


def test_register_rejects_without_touching_registry(training_config):
    run = make_run("r1", miou=0.3, time_s=100, config=training_config)
    tracker, registry = FakeTracker({"r1": run}), FakeRegistry()

    decision = RegisterStage(registry, tracker, "tune-model").execute(
        "r1", PromotionThresholds(min_primary_metric=0.6)
    )

    assert decision is PromotionStage.REJECTED
    assert registry.versions == []


def test_compare_computes_saving_and_quality_delta(training_config):
    runs = {
        "b": make_run("b", miou=0.80, time_s=200, config=training_config),
        "o": make_run("o", miou=0.79, time_s=120, config=training_config),
    }
    result = CompareStage(FakeTracker(runs)).execute("b", "o")

    assert result.time_saving_ratio == pytest.approx(0.4)
    assert result.quality_delta == pytest.approx(-0.01)
