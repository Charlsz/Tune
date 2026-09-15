"""Prepara datasets versionados bajo ``data/<name>/<version>/``.

Ejemplos:
  # Solo carpetas + metadata (EO / layout vacío)
  python scripts/prepare_data.py --name hls_burn_scars --version 1.0 --init-layout

  # Smoke CPU: descarga CIFAR-10 reducido como ImageFolder (correr en Docker CPU)
  python scripts/prepare_data.py --name cifar10_smoke --version 1.0 --download-cpu-smoke
"""

from __future__ import annotations

import argparse
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
    """Materializa un ImageFolder pequeño a partir de CIFAR-10 (torchvision).

    Usa un modelo preentrenado externo (ResNet18/ImageNet) en el trainer.
    CIFAR-10 es el dataset liviano para validar el *laboratorio* en CPU;
    el caso científico EO sigue siendo Burn Scars en GPU.
    """
    from torchvision import datasets

    target.mkdir(parents=True, exist_ok=True)
    for split in ("train", "val", "test"):
        (target / split).mkdir(parents=True, exist_ok=True)

    # CIFAR-10: 10 clases; usamos 3 para smoke rápido.
    class_ids = (0, 1, 2)  # airplane, automobile, bird
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

    # train -> train/val split 80/20 de un tope por clase
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
    dumped = yaml.safe_dump(meta, sort_keys=False, allow_unicode=True)
    meta_path.write_text(dumped, encoding="utf-8")
    print(f"[prepare_data] cpu-smoke OK -> {target} counts={counts}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--name", required=True)
    p.add_argument("--version", required=True)
    p.add_argument("--data-dir", default="data", type=Path)
    p.add_argument("--init-layout", action="store_true")
    p.add_argument(
        "--download-cpu-smoke",
        action="store_true",
        help="Descarga CIFAR-10 reducido a ImageFolder (requiere torchvision).",
    )
    p.add_argument("--max-per-class", type=int, default=64)
    p.add_argument("--source", default=None)
    args = p.parse_args()

    target = args.data_dir / args.name / args.version

    if args.download_cpu_smoke:
        if args.name != "cifar10_smoke":
            raise SystemExit(" --download-cpu-smoke espera --name cifar10_smoke")
        download_cpu_smoke(target, max_per_class=args.max_per_class)
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
        "Usa --init-layout o --download-cpu-smoke.\n"
        f"Fuentes conocidas: {sorted(KNOWN_SOURCES)}"
    )


if __name__ == "__main__":
    main()
