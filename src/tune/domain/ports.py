"""Puertos: interfaces que la capa de aplicación necesita y la infraestructura implementa.

Se usan ``Protocol`` para no obligar a herencia. Cada adaptador en
``tune.infrastructure`` implementa uno de estos.
"""

from __future__ import annotations

from typing import Any, Protocol

from tune.domain.entities import (
    DatasetSpec,
    EfficiencyMetrics,
    PromotionStage,
    QualityMetrics,
    RunResult,
    TrainingConfig,
)


class ConfigRepository(Protocol):
    """Carga configs de entrenamiento y thresholds (YAML en ``configs/``)."""

    def load_training_config(self, strategy: str) -> TrainingConfig: ...


class DatasetRepository(Protocol):
    """Acceso al dataset versionado en ``data/``."""

    def validate(self, spec: DatasetSpec) -> None:
        """Lanza ``ValueError`` si faltan splits o metadatos."""
        ...


class Trainer(Protocol):
    """Motor de entrenamiento intercambiable (PyTorch/Lightning, TerraTorch...)."""

    def train(self, config: TrainingConfig) -> tuple[str, EfficiencyMetrics]:
        """Entrena y devuelve ``(checkpoint_uri, eficiencia)``."""
        ...


class Evaluator(Protocol):
    """Evalúa un checkpoint sobre el test set de la tarea."""

    def evaluate(self, checkpoint_uri: str, config: TrainingConfig) -> QualityMetrics: ...


class ExperimentTracker(Protocol):
    """Tracking de corridas (MLflow)."""

    def start_run(self, name: str, tags: dict[str, str] | None = None) -> str: ...

    def log_params(self, run_id: str, params: dict[str, Any]) -> None: ...

    def log_metrics(
        self, run_id: str, metrics: dict[str, float], step: int | None = None
    ) -> None: ...

    def log_artifact(self, run_id: str, local_path: str) -> None: ...

    def end_run(self, run_id: str) -> None: ...

    def get_run(self, run_id: str) -> RunResult: ...


class ModelRegistry(Protocol):
    """Registro y promoción de versiones de modelo (MLflow Model Registry)."""

    def register(self, run: RunResult, model_name: str) -> str:
        """Devuelve la versión registrada."""
        ...

    def set_stage(self, model_name: str, version: str, stage: PromotionStage) -> None: ...

    def resolve(self, model_name: str, alias: str) -> str:
        """Devuelve la URI del modelo para un alias (p. ej. ``approved``)."""
        ...


class Predictor(Protocol):
    """Inferencia servida por la API/CLI."""

    @property
    def model_version(self) -> str: ...

    def predict(self, payload: Any) -> Any: ...
