"""init_layout y layout EO pasan FilesystemDatasetRepository.validate."""

from pathlib import Path

from tune.domain.entities import DatasetSpec
from tune.infrastructure.data.filesystem import FilesystemDatasetRepository
from tune.infrastructure.data.layout import init_layout, resolve_source, write_metadata


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
            splits=("train", "val", "test"),
        )
    )
    assert "hls_burn_scars" in (root / "metadata.yaml").read_text(encoding="utf-8")


def test_terratorch_burn_scars_layout_validates(tmp_path: Path) -> None:
    root = tmp_path / "hls_burn_scars" / "1.0"
    (root / "data").mkdir(parents=True)
    (root / "splits").mkdir(parents=True)
    (root / "data" / "sample_merged.tif").write_bytes(b"fake")
    (root / "data" / "sample.mask.tif").write_bytes(b"fake")
    for split in ("train", "val", "test"):
        (root / "splits" / f"{split}.txt").write_text("sample_merged.tif\n", encoding="utf-8")
    write_metadata(
        root,
        name="hls_burn_scars",
        version="1.0",
        source=resolve_source("hls_burn_scars", None),
    )

    FilesystemDatasetRepository(tmp_path).validate(
        DatasetSpec(
            name="hls_burn_scars",
            version="1.0",
            root="hls_burn_scars/1.0",
            splits=("train", "val", "test"),
        )
    )
