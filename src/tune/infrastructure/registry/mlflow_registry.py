"""Adaptador ``ModelRegistry`` sobre MLflow Model Registry.

Los stages del flujo de promoción (``trained → evaluated → candidate → approved``)
se representan como *aliases* de MLflow, no como los stages legacy.
"""

from __future__ import annotations

from tune.domain.entities import PromotionStage, RunResult


class MlflowModelRegistry:
    def __init__(self, tracking_uri: str) -> None:
        import mlflow  # noqa: PLC0415

        self._client = mlflow.MlflowClient(tracking_uri)

    def register(self, run: RunResult, model_name: str) -> str:
        mv = self._client.create_model_version(
            name=model_name, source=run.checkpoint_uri, run_id=run.run_id
        )
        return str(mv.version)

    def set_stage(self, model_name: str, version: str, stage: PromotionStage) -> None:
        self._client.set_registered_model_alias(model_name, stage.value, version)

    def resolve(self, model_name: str, alias: str) -> str:
        mv = self._client.get_model_version_by_alias(model_name, alias)
        return f"models:/{model_name}@{alias}#{mv.version}"
