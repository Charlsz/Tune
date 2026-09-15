"""Composición de dependencias (el único lugar que conoce todas las implementaciones)."""

from __future__ import annotations

from functools import cached_property

from tune.application.stages import (
    CompareStage,
    EvaluateStage,
    PrepareStage,
    RegisterStage,
    TrainStage,
)
from tune.infrastructure.config import Settings, YamlConfigRepository, get_settings
from tune.infrastructure.data import FilesystemDatasetRepository


class Container:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    @cached_property
    def configs(self) -> YamlConfigRepository:
        return YamlConfigRepository(self.settings.tune_configs_dir)

    @cached_property
    def datasets(self) -> FilesystemDatasetRepository:
        return FilesystemDatasetRepository(self.settings.tune_data_dir)

    @cached_property
    def tracker(self):
        if self.settings.tune_tracker == "json":
            from tune.infrastructure.tracking.json_tracker import JsonRunTracker  # noqa: PLC0415

            return JsonRunTracker(self.settings.tune_artifacts_dir / "runs")
        from tune.infrastructure.tracking import MlflowTracker  # noqa: PLC0415

        return MlflowTracker(
            self.settings.mlflow_tracking_uri, self.settings.mlflow_experiment_name
        )

    @cached_property
    def registry(self):
        if self.settings.tune_tracker == "json":
            from tune.infrastructure.registry.file_registry import (
                FileModelRegistry,  # noqa: PLC0415
            )

            return FileModelRegistry(self.settings.tune_artifacts_dir / "registry")
        from tune.infrastructure.registry import MlflowModelRegistry  # noqa: PLC0415

        return MlflowModelRegistry(self.settings.mlflow_tracking_uri)

    @cached_property
    def trainer(self):
        from tune.infrastructure.training.lightning_trainer import (  # noqa: PLC0415
            LightningTrainer,
        )

        return LightningTrainer(
            str(self.settings.tune_artifacts_dir), str(self.settings.tune_data_dir)
        )

    @cached_property
    def evaluator(self):
        from tune.infrastructure.evaluation.segmentation import TaskEvaluator  # noqa: PLC0415

        return TaskEvaluator(str(self.settings.tune_data_dir))

    @cached_property
    def prepare(self) -> PrepareStage:
        return PrepareStage(self.datasets)

    @cached_property
    def train(self) -> TrainStage:
        return TrainStage(self.trainer, self.tracker)

    @cached_property
    def evaluate(self) -> EvaluateStage:
        return EvaluateStage(self.evaluator, self.tracker)

    @cached_property
    def register(self) -> RegisterStage:
        return RegisterStage(self.registry, self.tracker, self.settings.tune_model_name)

    @cached_property
    def compare(self) -> CompareStage:
        return CompareStage(self.tracker)
