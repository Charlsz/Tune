"""Stage ``prepare``: valida que el dataset exista y tenga el layout esperado."""

from __future__ import annotations

from dataclasses import dataclass

from tune.domain.entities import DatasetSpec
from tune.domain.ports import DatasetRepository


@dataclass
class PrepareStage:
    datasets: DatasetRepository

    def execute(self, spec: DatasetSpec) -> DatasetSpec:
        self.datasets.validate(spec)
        return spec
