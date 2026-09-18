"""Prepara datasets versionados bajo ``data/<name>/<version>/``.

Ejemplos:
  # Solo carpetas + metadata (EO / layout vacío)
  python scripts/prepare_data.py --name hls_burn_scars --version 1.0 --init-layout

  # Smoke CPU: descarga CIFAR-10 reducido como ImageFolder (correr en Docker CPU)
  python scripts/prepare_data.py --name cifar10_smoke --version 1.0 --download-cpu-smoke

  # Caso científico: HLS Burn Scars (HF) + splits oficiales Prithvi BurnScars
  python scripts/prepare_data.py --name hls_burn_scars --version 1.0 --download-burn-scars
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from tune.infrastructure.data.layout import (  # noqa: E402
    KNOWN_SOURCES,
    init_layout,
    resolve_source,
    write_metadata,
)


def download_cpu_smoke(target: Path, *, max_per_class: int = 64) -> None:
    """Materializa un ImageFolder pequeño a partir de CIFAR-10 (torchvision)."""
    from torchvision import datasets

    target.mkdir(parents=True, exist_ok=True)
    for split in ("train", "val", "test"):
        (target / split).mkdir(parents=True, exist_ok=True)

    class_ids = (0, 1, 2)
    raw = datasets.CIFAR10(root=str(target / "_raw"), train=True, download=True)
    test_raw = datasets.CIFAR10(root=str(target / "_raw"), train=False, download=True)

    counts = {"train": 0, "val": 0, "test": 0}
    per_class_train: dict[int, int] = {c: 0 for c in class_ids}
    per_class_val: dict[int, int] = {c: 0 for c in class_ids}
    per_class_test: dict[int, int] = {c: 0 for c in class_ids}

    name_by_id = {i: raw.classes[i] for i in class_ids}
    for c in class_ids:
        for split in ("train", "val", "test"):
            (target / split / name_by_id[c]).mkdir(parents=True, exist_ok=True)

    def _save(img, label: int, split: str, idx: int) -> None:
        path = target / split / name_by_id[label] / f"{idx:05d}.png"
        img.save(path)

    for _idx, (img, label) in enumerate(raw):
        if label not in class_ids:
            continue
        if per_class_train[label] < int(max_per_class * 0.8):
            _save(img, label, "train", per_class_train[label])
            per_class_train[label] += 1
            counts["train"] += 1
        elif per_class_val[label] < max_per_class - int(max_per_class * 0.8):
            _save(img, label, "val", per_class_val[label])
            per_class_val[label] += 1
            counts["val"] += 1

    for _idx, (img, label) in enumerate(test_raw):
        if label not in class_ids:
            continue
        if per_class_test[label] >= max(8, max_per_class // 4):
            continue
        _save(img, label, "test", per_class_test[label])
        per_class_test[label] += 1
        counts["test"] += 1

    write_metadata(
        target,
        name="cifar10_smoke",
        version=target.name,
        source="https://www.cs.toronto.edu/~kriz/cifar.html",
        license_name="CIFAR-10 research use",
        notes=(
            f"Subset ImageFolder para smoke CPU Tune. counts={counts}. "
            "Modelo a fine-tunear: torchvision ResNet18 preentrenado (ImageNet)."
        ),
    )
    import yaml

    meta_path = target / "metadata.yaml"
    meta = yaml.safe_load(meta_path.read_text(encoding="utf-8"))
    meta["sample_counts"] = counts
    meta_path.write_text(
        yaml.safe_dump(meta, sort_keys=False, allow_unicode=True), encoding="utf-8"
    )
    print(f"[prepare_data] cpu-smoke OK -> {target} counts={counts}")


def download_burn_scars(target: Path, *, max_files: int | None = None) -> None:
    """Descarga HLS Burn Scars + splits oficiales desde Hugging Face."""
    try:
        from huggingface_hub import hf_hub_download, list_repo_files, snapshot_download
    except ImportError as exc:
        raise SystemExit(
            "huggingface_hub es requerido. pip install huggingface_hub "
            "o usa la imagen Docker training (extras training)."
        ) from exc

    target.mkdir(parents=True, exist_ok=True)
    data_dir = target / "data"
    splits_dir = target / "splits"
    data_dir.mkdir(parents=True, exist_ok=True)
    splits_dir.mkdir(parents=True, exist_ok=True)

    print("[prepare_data] descargando dataset ibm-nasa-geospatial/hls_burn_scars ...")
    ds_cache = snapshot_download(
        repo_id="ibm-nasa-geospatial/hls_burn_scars",
        repo_type="dataset",
    )
    ds_path = Path(ds_cache)

    tifs = list(ds_path.rglob("*.tif")) + list(ds_path.rglob("*.tiff"))
    if max_files is not None:
        tifs = sorted(tifs)[: max(1, max_files) * 4]

    copied = 0
    for src in tifs:
        dest = data_dir / src.name
        if not dest.exists():
            shutil.copy2(src, dest)
            copied += 1
    print(f"[prepare_data] geotiffs en data/: {copied} nuevos, listados={len(tifs)}")

    print("[prepare_data] descargando splits desde Prithvi-EO-2.0-300M-BurnScars ...")
    split_repo = "ibm-nasa-geospatial/Prithvi-EO-2.0-300M-BurnScars"
    files = list_repo_files(split_repo, repo_type="model")
    split_files = [f for f in files if "split" in f.lower() and f.endswith(".txt")]
    for rel in split_files:
        local = hf_hub_download(repo_id=split_repo, filename=rel, repo_type="model")
        shutil.copy2(local, splits_dir / Path(rel).name)

    if not (splits_dir / "train.txt").exists():
        _write_fallback_splits(data_dir, splits_dir)

    if max_files is not None and max_files > 0:
        for split_name in ("train", "val", "test"):
            sp = splits_dir / f"{split_name}.txt"
            if not sp.exists():
                continue
            lines = [ln.strip() for ln in sp.read_text(encoding="utf-8").splitlines() if ln.strip()]
            n = max_files if split_name == "train" else max(2, max_files // 4)
            sp.write_text("\n".join(lines[:n]) + ("\n" if lines else ""), encoding="utf-8")

    counts = {}
    for split_name in ("train", "val", "test"):
        sp = splits_dir / f"{split_name}.txt"
        if sp.exists():
            counts[split_name] = len(
                [ln for ln in sp.read_text(encoding="utf-8").splitlines() if ln.strip()]
            )
        else:
            counts[split_name] = 0

    write_metadata(
        target,
        name="hls_burn_scars",
        version=target.name,
        source="https://huggingface.co/datasets/ibm-nasa-geospatial/hls_burn_scars",
        license_name="dataset license (HF ibm-nasa-geospatial)",
        notes=(
            "HLS Burn Scars + splits Prithvi BurnScars. "
            f"counts={counts}. Modelo: ibm-nasa-geospatial/Prithvi-EO-2.0-300M"
        ),
    )
    import yaml

    meta_path = target / "metadata.yaml"
    meta = yaml.safe_load(meta_path.read_text(encoding="utf-8"))
    meta["sample_counts"] = counts
    meta_path.write_text(
        yaml.safe_dump(meta, sort_keys=False, allow_unicode=True), encoding="utf-8"
    )
    print(f"[prepare_data] burn-scars OK -> {target} counts={counts}")


def _write_fallback_splits(data_dir: Path, splits_dir: Path) -> None:
    merged = sorted(data_dir.glob("*_merged.tif"))
    if not merged:
        merged = sorted(p for p in data_dir.glob("*.tif") if "mask" not in p.name.lower())
    stems = [p.name for p in merged]
    n = len(stems)
    if n == 0:
        raise SystemExit("No se encontraron geotiffs para generar splits.")
    n_train = max(1, int(n * 0.7))
    n_val = max(1, int(n * 0.15))
    train, val, test = stems[:n_train], stems[n_train : n_train + n_val], stems[n_train + n_val :]
    if not test:
        test = val[-1:] if val else train[-1:]
        val = val[:-1] if len(val) > 1 else train[-1:]
    (splits_dir / "train.txt").write_text("\n".join(train) + "\n", encoding="utf-8")
    (splits_dir / "val.txt").write_text("\n".join(val) + "\n", encoding="utf-8")
    (splits_dir / "test.txt").write_text("\n".join(test) + "\n", encoding="utf-8")
    print(f"[prepare_data] splits fallback generados n={n}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--name", required=True)
    p.add_argument("--version", required=True)
    p.add_argument("--data-dir", default="data", type=Path)
    p.add_argument("--init-layout", action="store_true")
    p.add_argument("--download-cpu-smoke", action="store_true")
    p.add_argument("--download-burn-scars", action="store_true")
    p.add_argument("--max-files", type=int, default=None)
    p.add_argument("--max-per-class", type=int, default=64)
    p.add_argument("--source", default=None)
    args = p.parse_args()

    target = args.data_dir / args.name / args.version

    if args.download_cpu_smoke:
        if args.name != "cifar10_smoke":
            raise SystemExit("--download-cpu-smoke espera --name cifar10_smoke")
        download_cpu_smoke(target, max_per_class=args.max_per_class)
        return

    if args.download_burn_scars:
        if args.name != "hls_burn_scars":
            raise SystemExit("--download-burn-scars espera --name hls_burn_scars")
        download_burn_scars(target, max_files=args.max_files)
        return

    try:
        source = resolve_source(args.name, args.source)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    if args.init_layout:
        init_layout(target, name=args.name, version=args.version, source=source)
        print(f"[prepare_data] layout OK -> {target}")
        return

    raise SystemExit(
        "Usa --init-layout, --download-cpu-smoke o --download-burn-scars.\n"
        f"Fuentes conocidas: {sorted(KNOWN_SOURCES)}"
    )


if __name__ == "__main__":
    main()
