"""Dataset en disco bajo ``data/<name>/<version>/<split>/`` con un ``metadata.yaml``."""

from __future__ import annotations

from pathlib import Path

from tune.domain.entities import DatasetSpec


class FilesystemDatasetRepository:
    def __init__(self, data_dir: Path) -> None:
        self.data_dir = Path(data_dir)

    def validate(self, spec: DatasetSpec) -> None:
        root = self.data_dir / spec.root
        if not root.exists():
            raise ValueError(
                f"Dataset '{spec.name}' v{spec.version} no encontrado en {root}. "
                "Ver data/README.md para descargarlo y versionarlo."
            )
        missing = [s for s in spec.splits if not (root / s).exists()]
        if missing:
            raise ValueError(f"Faltan splits {missing} en {root}")
        if not (root / "metadata.yaml").exists():
            raise ValueError(f"Falta metadata.yaml en {root} (versión, fuente, checksum)")
