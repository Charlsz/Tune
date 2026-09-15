"""Tracker en disco/JSON para smoke local sin servidor MLflow."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from tune.domain.entities import (
    DatasetSpec,
    EfficiencyMetrics,
    ModelSpec,
    QualityMetrics,
    RunResult,
    Strategy,
    TrainingConfig,
)


class JsonRunTracker:
    """Persiste corridas en ``artifacts/runs/<run_id>.json``."""

    def __init__(self, runs_dir: Path) -> None:
        self.runs_dir = Path(runs_dir)
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        self._open: dict[str, dict[str, Any]] = {}

    def start_run(self, name: str, tags: dict[str, str] | None = None) -> str:
        run_id = uuid.uuid4().hex[:12]
        self._open[run_id] = {
            "run_id": run_id,
            "name": name,
            "tags": tags or {},
            "params": {},
            "metrics": {},
            "quality": None,
            "efficiency": None,
            "checkpoint_uri": "",
            "config": None,
        }
        return run_id

    def log_params(self, run_id: str, params: dict[str, Any]) -> None:
        bucket = self._open[run_id]["params"]
        for k, v in params.items():
            bucket[str(k)] = _jsonable(v)
            if k == "checkpoint_uri":
                self._open[run_id]["checkpoint_uri"] = str(v)

    def log_metrics(self, run_id: str, metrics: dict[str, float], step: int | None = None) -> None:
        del step
        self._open[run_id]["metrics"].update({str(k): float(v) for k, v in metrics.items()})

    def log_artifact(self, run_id: str, local_path: str) -> None:
        self._open[run_id].setdefault("artifacts", []).append(local_path)

    def end_run(self, run_id: str) -> None:
        path = self.runs_dir / f"{run_id}.json"
        path.write_text(json.dumps(self._open[run_id], indent=2), encoding="utf-8")

    def attach_training_result(
        self,
        run_id: str,
        *,
        config: TrainingConfig,
        efficiency: EfficiencyMetrics,
        checkpoint_uri: str,
    ) -> None:
        self._open[run_id]["config"] = _config_to_dict(config)
        self._open[run_id]["efficiency"] = {
            "train_time_s": efficiency.train_time_s,
            "peak_gpu_memory_mb": efficiency.peak_gpu_memory_mb,
            "gpu_hours": efficiency.gpu_hours,
            "hardware": efficiency.hardware,
        }
        self._open[run_id]["checkpoint_uri"] = checkpoint_uri

    def attach_quality(self, run_id: str, quality: QualityMetrics) -> None:
        state = self._load(run_id)
        state["quality"] = {"values": quality.values, "primary": quality.primary}
        self._open[run_id] = state
        self.end_run(run_id)

    def get_run(self, run_id: str) -> RunResult:
        state = self._load(run_id)
        if not state.get("config") or not state.get("efficiency"):
            raise KeyError(f"Run {run_id} incompleto: falta config/efficiency")
        config = _config_from_dict(state["config"])
        eff = state["efficiency"]
        efficiency = EfficiencyMetrics(
            train_time_s=float(eff["train_time_s"]),
            peak_gpu_memory_mb=eff.get("peak_gpu_memory_mb"),
            gpu_hours=eff.get("gpu_hours"),
            hardware=str(eff["hardware"]),
        )
        q = state.get("quality")
        if q is None:
            quality = QualityMetrics(values={"accuracy": 0.0}, primary="accuracy")
        else:
            quality = QualityMetrics(
                values={k: float(v) for k, v in q["values"].items()}, primary=q["primary"]
            )
        return RunResult(
            run_id=run_id,
            config=config,
            efficiency=efficiency,
            quality=quality,
            checkpoint_uri=str(state.get("checkpoint_uri") or ""),
        )

    def _load(self, run_id: str) -> dict[str, Any]:
        if run_id in self._open:
            return self._open[run_id]
        path = self.runs_dir / f"{run_id}.json"
        if not path.exists():
            raise KeyError(f"Run no encontrado: {run_id}")
        state = json.loads(path.read_text(encoding="utf-8"))
        self._open[run_id] = state
        return state


def _jsonable(v: Any) -> Any:
    if hasattr(v, "value"):
        return v.value
    if isinstance(v, (str, int, float, bool)) or v is None:
        return v
    return str(v)


def _config_to_dict(config: TrainingConfig) -> dict[str, Any]:
    return {
        "strategy": config.strategy.value,
        "dataset": {
            "name": config.dataset.name,
            "version": config.dataset.version,
            "root": config.dataset.root,
            "splits": list(config.dataset.splits),
        },
        "model": {
            "name": config.model.name,
            "source": config.model.source,
            "task": config.model.task,
        },
        "seed": config.seed,
        "epochs": config.epochs,
        "batch_size": config.batch_size,
        "learning_rate": config.learning_rate,
        "precision": config.precision,
        "peft": config.peft,
        "extra": config.extra,
    }


def _config_from_dict(raw: dict[str, Any]) -> TrainingConfig:
    ds, model = raw["dataset"], raw["model"]
    return TrainingConfig(
        strategy=Strategy(raw["strategy"]),
        dataset=DatasetSpec(
            name=ds["name"],
            version=str(ds["version"]),
            root=ds["root"],
            splits=tuple(ds.get("splits", ("train", "val", "test"))),
        ),
        model=ModelSpec(name=model["name"], source=model["source"], task=model["task"]),
        seed=int(raw.get("seed", 42)),
        epochs=int(raw.get("epochs", 1)),
        batch_size=int(raw.get("batch_size", 8)),
        learning_rate=float(raw.get("learning_rate", 1e-4)),
        precision=str(raw.get("precision", "32")),
        peft=raw.get("peft"),
        extra=raw.get("extra") or {},
    )
