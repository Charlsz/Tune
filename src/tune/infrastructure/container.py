"""Composición de dependencias (el único lugar que conoce todas las implementaciones)."""

from __future__ import annotations

from functools import cached_property

from tune.application.analyze import AnalyzeUseCase
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

    # --- aplicación EO: imagen -> máscara con checkpoints Prithvi publicados ---

    @cached_property
    def segmenter(self):
        from tune.infrastructure.inference.prithvi import PrithviSegmenter  # noqa: PLC0415

        return PrithviSegmenter(device=self.settings.tune_device or None)

    @cached_property
    def analyses(self):
        from tune.infrastructure.analyses import FileAnalysisRepository  # noqa: PLC0415

        return FileAnalysisRepository(self.settings.tune_artifacts_dir / "analyses")

    @cached_property
    def reference(self):
        from tune.infrastructure.reference.composite import (  # noqa: PLC0415
            CompositeReferenceProvider,
        )
        from tune.infrastructure.reference.history import (  # noqa: PLC0415
            HistoryReferenceProvider,
        )

        root = self.settings.tune_artifacts_dir / "analyses"
        history = HistoryReferenceProvider(self.analyses, root)
        providers: list = []
        if self.settings.tune_reference_jrc:
            from tune.infrastructure.reference.jrc import JrcReferenceProvider  # noqa: PLC0415

            providers.append(
                JrcReferenceProvider(
                    self.settings.tune_artifacts_dir / "jrc",
                    permanent_pct=self.settings.tune_jrc_permanent_pct,
                )
            )
        providers.append(history)
        return CompositeReferenceProvider(providers)

    @cached_property
    def observation(self):
        from tune.infrastructure.observation.stac import (  # noqa: PLC0415
            CompositeObservationProvider,
            StacObservationProvider,
        )

        root = self.settings.tune_artifacts_dir / "observation"
        token = self.settings.earthdata_token or None
        providers = []
        if self.settings.tune_observe_gfm:
            providers.append(StacObservationProvider("gfm", root / "gfm"))
        if self.settings.tune_observe_opera:
            providers.append(
                StacObservationProvider("opera_dswx_s1", root / "opera_s1", token=token)
            )
            providers.append(
                StacObservationProvider("opera_dswx_hls", root / "opera_hls", token=token)
            )
        return CompositeObservationProvider(providers) if providers else None

    @cached_property
    def exposure(self):
        if not self.settings.tune_exposure:
            return None
        from tune.infrastructure.exposure.composite import (  # noqa: PLC0415
            RasterExposureProvider,
        )

        return RasterExposureProvider(self.settings.tune_artifacts_dir / "exposure")

    @cached_property
    def analyze(self) -> AnalyzeUseCase:
        return AnalyzeUseCase(
            self.segmenter,
            self.analyses,
            reference=self.reference,
            observation=self.observation,
            exposure=self.exposure,
        )

    @cached_property
    def catalog(self):
        from tune.infrastructure.catalog.stac import StacCatalog  # noqa: PLC0415

        return StacCatalog(max_km=self.settings.tune_catalog_max_km)
