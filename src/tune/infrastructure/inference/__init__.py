"""``Predictor`` que resuelve el modelo desde MLflow por alias. Esqueleto (Fase 5)."""

from __future__ import annotations

from typing import Any

from tune.domain.ports import ModelRegistry


class RegistryPredictor:
    def __init__(self, registry: ModelRegistry, model_name: str, alias: str) -> None:
        self._uri = registry.resolve(model_name, alias)
        self._version = self._uri.rsplit("#", 1)[-1]

    @property
    def model_version(self) -> str:
        return self._version

    def predict(self, payload: Any) -> Any:
        # TODO(fase 5): cargar con mlflow.pytorch.load_model(self._uri) y ejecutar
        # la inferencia de la tarea del caso.
        raise NotImplementedError("RegistryPredictor.predict se implementa en la Fase 5")
