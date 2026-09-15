"""Tests del tracker JSON (smoke sin MLflow)."""

from pathlib import Path

from tune.domain.entities import (
    DatasetSpec,
    EfficiencyMetrics,
    ModelSpec,
    QualityMetrics,
    Strategy,
    TrainingConfig,
)
from tune.infrastructure.tracking.json_tracker import JsonRunTracker


def test_json_tracker_roundtrip(tmp_path: Path) -> None:
    tracker = JsonRunTracker(tmp_path)
    cfg = TrainingConfig(
        strategy=Strategy.BASELINE,
        dataset=DatasetSpec(name="toy", version="1", root="toy/1"),
        model=ModelSpec(name="resnet18", source="torchvision/resnet18", task="classification"),
    )
    run_id = tracker.start_run("t")
    tracker.attach_training_result(
        run_id,
        config=cfg,
        efficiency=EfficiencyMetrics(1.5, None, 1.5 / 3600, "cpu"),
        checkpoint_uri="file:///tmp/m.pt",
    )
    tracker.end_run(run_id)
    tracker.attach_quality(run_id, QualityMetrics(values={"accuracy": 0.5}, primary="accuracy"))

    got = tracker.get_run(run_id)
    assert got.quality.primary_value == 0.5
    assert got.config.model.task == "classification"
