"""Adaptador ``ExperimentTracker`` sobre MLflow Tracking.

``mlflow`` se importa de forma perezosa: instalar con ``pip install -e ".[tracking]"``.
"""

from __future__ import annotations

from typing import Any

from tune.domain.entities import RunResult


class MlflowTracker:
    def __init__(self, tracking_uri: str, experiment_name: str) -> None:
        import mlflow  # noqa: PLC0415

        self._mlflow = mlflow
        mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment(experiment_name)
        self._client = mlflow.MlflowClient(tracking_uri)

    def start_run(self, name: str, tags: dict[str, str] | None = None) -> str:
        run = self._mlflow.start_run(run_name=name, tags=tags)
        return run.info.run_id

    def log_params(self, run_id: str, params: dict[str, Any]) -> None:
        for k, v in params.items():
            self._client.log_param(run_id, k, v)

    def log_metrics(self, run_id: str, metrics: dict[str, float], step: int | None = None) -> None:
        for k, v in metrics.items():
            self._client.log_metric(run_id, k, v, step=step or 0)

    def log_artifact(self, run_id: str, local_path: str) -> None:
        self._client.log_artifact(run_id, local_path)

    def end_run(self, run_id: str) -> None:  # noqa: ARG002
        self._mlflow.end_run()

    def get_run(self, run_id: str) -> RunResult:
        # TODO(fase 2): reconstruir RunResult desde params/metrics del run.
        raise NotImplementedError("MlflowTracker.get_run se implementa en la Fase 2")
