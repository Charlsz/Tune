"""``MlflowTracker``: tracking + reconstrucción de ``RunResult`` para compare/register."""

from __future__ import annotations

import json
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


class MlflowTracker:
    def __init__(self, tracking_uri: str, experiment_name: str) -> None:
        import mlflow  # noqa: PLC0415

        self._mlflow = mlflow
        mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment(experiment_name)
        self._client = mlflow.MlflowClient(tracking_uri)
        self._cache: dict[str, dict[str, Any]] = {}

    def start_run(self, name: str, tags: dict[str, str] | None = None) -> str:
        run = self._mlflow.start_run(run_name=name, tags=tags)
        rid = run.info.run_id
        self._cache[rid] = {
            "config": None,
            "efficiency": None,
            "quality": None,
            "checkpoint_uri": "",
        }
        return rid

    def log_params(self, run_id: str, params: dict[str, Any]) -> None:
        for k, v in params.items():
            val = v.value if hasattr(v, "value") else v
            if val is None:
                continue
            text = str(val)
            if len(text) > 500:
                text = text[:497] + "..."
            self._client.log_param(run_id, k, text)
            if k == "checkpoint_uri":
                self._cache.setdefault(run_id, {})["checkpoint_uri"] = str(val)

    def log_metrics(self, run_id: str, metrics: dict[str, float], step: int | None = None) -> None:
        for k, v in metrics.items():
            self._client.log_metric(run_id, k, float(v), step=step or 0)

    def log_artifact(self, run_id: str, local_path: str) -> None:
        self._client.log_artifact(run_id, local_path)

    def end_run(self, run_id: str) -> None:  # noqa: ARG002
        self._mlflow.end_run()

    def attach_training_result(
        self,
        run_id: str,
        *,
        config: TrainingConfig,
        efficiency: EfficiencyMetrics,
        checkpoint_uri: str,
    ) -> None:
        payload = {
            "config": _config_to_dict(config),
            "efficiency": {
                "train_time_s": efficiency.train_time_s,
                "peak_gpu_memory_mb": efficiency.peak_gpu_memory_mb,
                "gpu_hours": efficiency.gpu_hours,
                "hardware": efficiency.hardware,
            },
            "checkpoint_uri": checkpoint_uri,
        }
        self._cache[run_id] = {**self._cache.get(run_id, {}), **payload}
        # Artefacto JSON para get_run robusto
        import tempfile
        from pathlib import Path

        tmp = Path(tempfile.mkdtemp()) / "tune_run.json"
        tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        self._client.log_artifact(run_id, str(tmp))
        self._client.log_param(run_id, "checkpoint_uri", checkpoint_uri[:500])

    def attach_quality(self, run_id: str, quality: QualityMetrics) -> None:
        q = {"values": quality.values, "primary": quality.primary}
        self._cache.setdefault(run_id, {})["quality"] = q
        for k, v in quality.values.items():
            self._client.log_metric(run_id, f"test_{k}", float(v))
        import tempfile
        from pathlib import Path

        tmp = Path(tempfile.mkdtemp()) / "tune_quality.json"
        tmp.write_text(json.dumps(q, indent=2), encoding="utf-8")
        self._client.log_artifact(run_id, str(tmp))

    def get_run(self, run_id: str) -> RunResult:
        cached = self._cache.get(run_id)
        if cached and cached.get("config") and cached.get("efficiency"):
            return _result_from_cache(run_id, cached)

        run = self._client.get_run(run_id)
        params = run.data.params
        metrics = run.data.metrics

        # Prefer artefactos Tune si existen
        artifact = _try_load_artifact_json(self._client, run_id, "tune_run.json")
        quality_art = _try_load_artifact_json(self._client, run_id, "tune_quality.json")

        if artifact and "config" in artifact:
            config = _config_from_dict(artifact["config"])
            eff_raw = artifact["efficiency"]
            efficiency = EfficiencyMetrics(
                train_time_s=float(eff_raw["train_time_s"]),
                peak_gpu_memory_mb=eff_raw.get("peak_gpu_memory_mb"),
                gpu_hours=eff_raw.get("gpu_hours"),
                hardware=str(eff_raw["hardware"]),
            )
            checkpoint_uri = str(artifact.get("checkpoint_uri") or params.get("checkpoint_uri", ""))
        else:
            config = _config_from_params(params)
            efficiency = EfficiencyMetrics(
                train_time_s=float(metrics.get("train_time_s", 0.0)),
                peak_gpu_memory_mb=metrics.get("peak_gpu_memory_mb"),
                gpu_hours=metrics.get("gpu_hours"),
                hardware=str(params.get("hardware", "unknown")),
            )
            checkpoint_uri = str(params.get("checkpoint_uri", ""))

        if quality_art:
            quality = QualityMetrics(
                values={k: float(v) for k, v in quality_art["values"].items()},
                primary=quality_art["primary"],
            )
        else:
            qvals = {
                k.removeprefix("test_"): float(v)
                for k, v in metrics.items()
                if k.startswith("test_")
            }
            if not qvals:
                qvals = {"miou": 0.0}
            primary = "miou" if "miou" in qvals else next(iter(qvals))
            quality = QualityMetrics(values=qvals, primary=primary)

        return RunResult(
            run_id=run_id,
            config=config,
            efficiency=efficiency,
            quality=quality,
            checkpoint_uri=checkpoint_uri,
        )


def _result_from_cache(run_id: str, cached: dict[str, Any]) -> RunResult:
    config = cached["config"]
    if isinstance(config, dict):
        config = _config_from_dict(config)
    eff = cached["efficiency"]
    if isinstance(eff, dict):
        efficiency = EfficiencyMetrics(
            train_time_s=float(eff["train_time_s"]),
            peak_gpu_memory_mb=eff.get("peak_gpu_memory_mb"),
            gpu_hours=eff.get("gpu_hours"),
            hardware=str(eff["hardware"]),
        )
    else:
        efficiency = eff
    q = cached.get("quality")
    if q is None:
        quality = QualityMetrics(values={"miou": 0.0}, primary="miou")
    elif isinstance(q, QualityMetrics):
        quality = q
    else:
        quality = QualityMetrics(
            values={k: float(v) for k, v in q["values"].items()}, primary=q["primary"]
        )
    return RunResult(
        run_id=run_id,
        config=config,
        efficiency=efficiency,
        quality=quality,
        checkpoint_uri=str(cached.get("checkpoint_uri") or ""),
    )


def _try_load_artifact_json(client: Any, run_id: str, name: str) -> dict[str, Any] | None:
    import tempfile
    from pathlib import Path

    try:
        local = client.download_artifacts(run_id, name, tempfile.mkdtemp())
        path = Path(local)
        if path.is_dir():
            path = path / name
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return None


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


def _config_from_params(params: dict[str, str]) -> TrainingConfig:
    return TrainingConfig(
        strategy=Strategy(params.get("strategy", "baseline")),
        dataset=DatasetSpec(
            name=params.get("dataset.name", "hls_burn_scars"),
            version=params.get("dataset.version", "1.0"),
            root=params.get("dataset.root", "hls_burn_scars/1.0"),
            splits=("train", "val", "test"),
        ),
        model=ModelSpec(
            name=params.get("model.name", "prithvi-eo-2.0-300m"),
            source=params.get("model.source", "ibm-nasa-geospatial/Prithvi-EO-2.0-300M"),
            task=params.get("model.task", "segmentation"),
        ),
        seed=int(params.get("seed", 42)),
        epochs=int(params.get("epochs", 1)),
        batch_size=int(params.get("batch_size", 8)),
        learning_rate=float(params.get("learning_rate", 1e-4)),
        precision=params.get("precision", "32"),
    )
