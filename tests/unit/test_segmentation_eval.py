"""Lectura de métricas TerraTorch y probe de GPU externa (sin GPU ni terratorch)."""

from __future__ import annotations

from pathlib import Path

import pytest

from tune.infrastructure.training import instrumentation
from tune.infrastructure.training.segmentation_trainer import (
    parse_test_metrics_csv,
    pick_miou,
    quality_from_test_metrics,
)

_HEADER = ",".join(
    [
        "epoch",
        "step",
        "train/loss",
        "val/loss",
        "test/loss",
        "test/Multiclass_Jaccard_Index",
        "test/Multiclass_Jaccard_Index_Micro",
        "test/Multiclass_Jaccard_Index_Burn scar",
    ]
)
_CSV = _HEADER + "\n0,10,0.5,,,,,\n0,20,,0.4,,,,\n0,20,,,0.31,0.7321,0.91,0.55\n"


def test_parse_test_metrics_merges_rows_and_keeps_test_columns(tmp_path: Path) -> None:
    path = tmp_path / "metrics.csv"
    path.write_text(_CSV, encoding="utf-8")
    metrics = parse_test_metrics_csv(path)
    assert set(metrics) == {
        "test/loss",
        "test/Multiclass_Jaccard_Index",
        "test/Multiclass_Jaccard_Index_Micro",
        "test/Multiclass_Jaccard_Index_Burn scar",
    }
    assert metrics["test/Multiclass_Jaccard_Index"] == pytest.approx(0.7321)


def test_pick_miou_prefers_macro_jaccard() -> None:
    metrics = {
        "test/Multiclass_Jaccard_Index_Micro": 0.91,
        "test/Multiclass_Jaccard_Index_Burn scar": 0.55,
        "test/Multiclass_Jaccard_Index": 0.7321,
    }
    assert pick_miou(metrics) == pytest.approx(0.7321)


def test_pick_miou_exact_key_wins() -> None:
    assert pick_miou({"test/mIoU": 0.61, "test/Multiclass_Jaccard_Index": 0.5}) == 0.61


def test_quality_from_test_metrics_fails_loudly_without_iou() -> None:
    """Regresión: antes devolvía miou=0.0 en silencio y register rechazaba todo."""
    with pytest.raises(RuntimeError, match="no reportó mIoU"):
        quality_from_test_metrics({"test/loss": 0.3})


def test_quality_from_test_metrics_primary_is_miou() -> None:
    q = quality_from_test_metrics({"test/loss": 0.3, "test/Multiclass_Jaccard_Index": 0.7})
    assert q.primary == "miou"
    assert q.primary_value == pytest.approx(0.7)
    assert q.values["test_loss"] == pytest.approx(0.3)


def test_external_gpu_probe_without_nvidia_smi(monkeypatch) -> None:
    monkeypatch.setattr(instrumentation, "query_nvidia_smi", lambda *_a, **_k: None)
    probe = instrumentation.ExternalGpuProbe(poll_s=0.01)
    with probe.measure():
        pass
    assert probe.elapsed_s >= 0
    assert probe.peak_gpu_memory_mb is None


def test_external_gpu_probe_reports_peak_minus_baseline(monkeypatch) -> None:
    samples = iter(["1000", "1000", "4500", "6000", "2000"])

    def fake_query(field_name: str, gpu_index: int = 0):
        if field_name == "name":
            return "Fake RTX"
        try:
            return next(samples)
        except StopIteration:
            return "2000"

    monkeypatch.setattr(instrumentation, "query_nvidia_smi", fake_query)
    probe = instrumentation.ExternalGpuProbe(poll_s=0.005)
    with probe.measure():
        import time

        time.sleep(0.1)
    assert probe.hardware == "Fake RTX"
    assert probe.peak_gpu_memory_mb == pytest.approx(5000.0)
