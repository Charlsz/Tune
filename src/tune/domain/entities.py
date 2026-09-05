"""Entidades y objetos de valor del dominio Tune."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Strategy(str, Enum):
    """Las dos estrategias que Tune compara sobre el mismo caso de estudio."""

    BASELINE = "baseline"
    OPTIMIZED = "optimized"


class PromotionStage(str, Enum):
    """Flujo de promoción del Model Registry (plan.md, Fase 2.4)."""

    TRAINED = "trained"
    EVALUATED = "evaluated"
    CANDIDATE = "candidate"
    APPROVED = "approved"
    REJECTED = "rejected"


@dataclass(frozen=True)
class DatasetSpec:
    """Dataset versionado fuera de Git; aquí solo metadatos."""

    name: str
    version: str
    root: str
    splits: tuple[str, ...] = ("train", "val", "test")


@dataclass(frozen=True)
class ModelSpec:
    """Modelo preentrenado del caso de estudio (intercambiable, ADR 001)."""

    name: str
    source: str  # p. ej. id de Hugging Face o ruta local
    task: str  # p. ej. "segmentation", "classification"


@dataclass(frozen=True)
class TrainingConfig:
    """Config resuelta desde ``configs/training/<strategy>.yaml``."""

    strategy: Strategy
    dataset: DatasetSpec
    model: ModelSpec
    seed: int = 42
    epochs: int = 1
    batch_size: int = 8
    learning_rate: float = 1e-4
    precision: str = "32"  # "32" | "16-mixed" | "bf16-mixed"
    peft: dict[str, object] | None = None  # None = full fine-tuning
    extra: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class EfficiencyMetrics:
    """Lo que Tune mide siempre, independiente de la tarea."""

    train_time_s: float
    peak_gpu_memory_mb: float | None
    gpu_hours: float | None
    hardware: str


@dataclass(frozen=True)
class QualityMetrics:
    """Métricas de la tarea del caso de estudio (IoU, F1, accuracy...)."""

    values: dict[str, float]
    primary: str  # nombre de la métrica que decide la promoción

    @property
    def primary_value(self) -> float:
        return self.values[self.primary]


@dataclass(frozen=True)
class RunResult:
    """Una corrida completa: config + eficiencia + calidad + referencia al artefacto."""

    run_id: str
    config: TrainingConfig
    efficiency: EfficiencyMetrics
    quality: QualityMetrics
    checkpoint_uri: str


@dataclass(frozen=True)
class PromotionThresholds:
    """Criterios explícitos de promoción/rechazo (plan.md, Fase 4.3)."""

    min_primary_metric: float
    max_quality_drop_vs_baseline: float | None = None  # absoluto, p. ej. 0.02


@dataclass(frozen=True)
class ComparisonResult:
    """Baseline vs optimized sobre el mismo test set."""

    baseline: RunResult
    optimized: RunResult

    @property
    def time_saving_ratio(self) -> float:
        b = self.baseline.efficiency.train_time_s
        o = self.optimized.efficiency.train_time_s
        return 0.0 if b == 0 else (b - o) / b

    @property
    def quality_delta(self) -> float:
        """optimized − baseline en la métrica primaria (negativo = perdió calidad)."""
        return self.optimized.quality.primary_value - self.baseline.quality.primary_value
