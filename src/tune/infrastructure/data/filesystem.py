"""Dataset en disco: layout ImageFolder o layout EO TerraTorch.

Layouts aceptados bajo ``data/<name>/<version>/``:

1. Clasificación / smoke: ``train/``, ``val/``, ``test/`` (+ ``metadata.yaml``).
2. Segmentación Burn Scars: ``data/`` + ``splits/{train,val,test}.txt`` (+ ``metadata.yaml``).
"""

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
        if not (root / "metadata.yaml").exists():
            raise ValueError(f"Falta metadata.yaml en {root} (versión, fuente, checksum)")

        if _has_imagefolder_splits(root, spec.splits):
            return
        if _has_terratorch_splits(root, spec.splits):
            return

        raise ValueError(
            f"Layout inválido en {root}. Se espera:\n"
            f"  - carpetas {list(spec.splits)}/  (ImageFolder), o\n"
            f"  - data/ + splits/{{train,val,test}}.txt  (Burn Scars / TerraTorch).\n"
            "Ejecuta: make lab-data   # o --download-burn-scars / --download-cpu-smoke"
        )


def _has_imagefolder_splits(root: Path, splits: tuple[str, ...]) -> bool:
    return all((root / s).is_dir() for s in splits)


def _has_terratorch_splits(root: Path, splits: tuple[str, ...]) -> bool:
    data_dir = root / "data"
    splits_dir = root / "splits"
    if not data_dir.is_dir() or not splits_dir.is_dir():
        return False
    for s in splits:
        txt = splits_dir / f"{s}.txt"
        if not txt.is_file():
            return False
        # Al menos una línea no vacía
        if not any(ln.strip() for ln in txt.read_text(encoding="utf-8").splitlines()):
            return False
    # Al menos un geotiff (o cualquier archivo) en data/
    return any(data_dir.iterdir())
