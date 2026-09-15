"""init_layout deja un dataset validable por FilesystemDatasetRepository."""

from pathlib import Path

from tune.domain.entities import DatasetSpec
from tune.infrastructure.data.filesystem import FilesystemDatasetRepository
from tune.infrastructure.data.layout import init_layout, resolve_source


def test_resolve_source_known() -> None:
    assert "hls_burn_scars" in resolve_source("hls_burn_scars", None)


def test_init_layout_passes_filesystem_validation(tmp_path: Path) -> None:
    root = tmp_path / "hls_burn_scars" / "1.0"
    init_layout(
        root,
        name="hls_burn_scars",
        version="1.0",
        source=resolve_source("hls_burn_scars", None),
    )

    repo = FilesystemDatasetRepository(tmp_path)
    repo.validate(
        DatasetSpec(
            name="hls_burn_scars",
            version="1.0",
            root="hls_burn_scars/1.0",
            splits=["train", "val", "test"],
        )
    )
    assert "hls_burn_scars" in (root / "metadata.yaml").read_text(encoding="utf-8")
