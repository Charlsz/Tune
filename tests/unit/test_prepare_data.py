"""init_layout y layout EO pasan FilesystemDatasetRepository.validate."""

import io
import sys
import tarfile
from pathlib import Path

import pytest

from tune.domain.entities import DatasetSpec
from tune.infrastructure.data.filesystem import FilesystemDatasetRepository
from tune.infrastructure.data.layout import init_layout, resolve_source, write_metadata

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(_ROOT / "scripts"))

import prepare_data  # noqa: E402

_SPEC = DatasetSpec(
    name="hls_burn_scars", version="1.0", root="hls_burn_scars/1.0", splits=("train", "val", "test")
)


def _fake_tar(path: Path, stems: list[str]) -> None:
    """tar.gz con el layout real del repo HF: training/ y validation/ con pares tif."""
    with tarfile.open(path, "w:gz") as tar:
        for i, stem in enumerate(stems):
            sub = "training" if i % 3 else "validation"
            for suffix in ("_merged.tif", ".mask.tif"):
                data = b"fake"
                info = tarfile.TarInfo(name=f"hls_burn_scars/{sub}/{stem}{suffix}")
                info.size = len(data)
                tar.addfile(info, io.BytesIO(data))


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

    FilesystemDatasetRepository(tmp_path).validate(_SPEC)


def test_terratorch_layout_rejects_empty_data_dir(tmp_path: Path) -> None:
    """Regresión: data/ vacío pasaba la validación y TerraTorch moría con 0 imágenes."""
    root = tmp_path / "hls_burn_scars" / "1.0"
    (root / "data").mkdir(parents=True)
    (root / "splits").mkdir(parents=True)
    for split in ("train", "val", "test"):
        (root / "splits" / f"{split}.txt").write_text("T10SDH.2020248.v1\n", encoding="utf-8")
    write_metadata(root, name="hls_burn_scars", version="1.0", source="x")

    with pytest.raises(ValueError, match="Layout inválido"):
        FilesystemDatasetRepository(tmp_path).validate(_SPEC)


def test_collect_geotiffs_extracts_hf_tarball(tmp_path: Path) -> None:
    """El repo HF publica hls_burn_scars.tar.gz, no tifs sueltos: hay que extraer."""
    snapshot = tmp_path / "snapshot"
    snapshot.mkdir()
    stems = [f"subsetted_512x512_HLS.S30.T10SEH.20181{i}0.v1.4" for i in range(6)]
    _fake_tar(snapshot / "hls_burn_scars.tar.gz", stems)

    tifs = prepare_data.collect_geotiffs(snapshot, extract_dir=tmp_path / "_raw")
    assert len(tifs) == 12
    assert {prepare_data.stem_of(p) for p in tifs} == set(stems)

    # Segunda llamada: reutiliza lo extraído, no vuelve a descomprimir.
    again = prepare_data.collect_geotiffs(snapshot, extract_dir=tmp_path / "_raw")
    assert len(again) == 12


def test_stem_of_pairs_image_and_mask() -> None:
    img = Path("subsetted_512x512_HLS.S30.T10SDH.2020248.v1.4_merged.tif")
    mask = Path("subsetted_512x512_HLS.S30.T10SDH.2020248.v1.4.mask.tif")
    assert prepare_data.stem_of(img) == prepare_data.stem_of(mask)
    assert prepare_data.stem_of(img) == "subsetted_512x512_HLS.S30.T10SDH.2020248.v1.4"


def test_limit_pairs_keeps_image_and_mask_together() -> None:
    files = []
    for i in range(10):
        files.append(Path(f"scene{i:02d}_merged.tif"))
        files.append(Path(f"scene{i:02d}.mask.tif"))
    limited = prepare_data._limit_pairs(files, max_files=2)
    stems = [prepare_data.stem_of(p) for p in limited]
    assert len(limited) % 2 == 0
    assert all(stems.count(s) == 2 for s in set(stems))


def test_fallback_splits_write_stems_not_filenames(tmp_path: Path) -> None:
    """TerraTorch filtra por substring del split: '_merged.tif' en la línea dejaría
    fuera todas las máscaras."""
    data_dir = tmp_path / "data"
    splits_dir = tmp_path / "splits"
    data_dir.mkdir()
    splits_dir.mkdir()
    for i in range(8):
        (data_dir / f"scene{i}_merged.tif").write_bytes(b"x")
        (data_dir / f"scene{i}.mask.tif").write_bytes(b"x")

    prepare_data._write_fallback_splits(data_dir, splits_dir)

    lines = []
    for split in ("train", "val", "test"):
        content = (splits_dir / f"{split}.txt").read_text(encoding="utf-8").split()
        assert content, split
        lines.extend(content)
    assert len(lines) == 8
    assert all(not ln.endswith(".tif") for ln in lines)
    assert all("mask" not in ln and "merged" not in ln for ln in lines)
