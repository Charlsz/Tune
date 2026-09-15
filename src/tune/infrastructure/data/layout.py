"""Creación del layout versionado ``data/<name>/<version>/{train,val,test}`` + metadata."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import yaml

DEFAULT_SPLITS = ("train", "val", "test")

KNOWN_SOURCES: dict[str, str] = {
    "hls_burn_scars": "https://huggingface.co/datasets/ibm-nasa-geospatial/hls_burn_scars",
    "beans": "https://huggingface.co/datasets/beans",
}


def write_metadata(
    root: Path,
    *,
    name: str,
    version: str,
    source: str,
    license_name: str = "dataset-dependent",
    notes: str = "",
) -> Path:
    payload = {
        "name": name,
        "version": version,
        "source": source,
        "downloaded_at": date.today().isoformat(),
        "license": license_name,
        "splits": list(DEFAULT_SPLITS),
        "sample_counts": {s: 0 for s in DEFAULT_SPLITS},
        "checksum": None,
        "notes": notes
        or (
            "Layout inicializado por Tune; rellenar sample_counts y checksum "
            "cuando existan los archivos de cada split."
        ),
    }
    path = root / "metadata.yaml"
    path.write_text(yaml.safe_dump(payload, sort_keys=False, allow_unicode=True), encoding="utf-8")
    return path


def init_layout(root: Path, *, name: str, version: str, source: str) -> Path:
    """Crea splits vacíos + metadata.yaml. Devuelve ``root``."""
    root.mkdir(parents=True, exist_ok=True)
    for split in DEFAULT_SPLITS:
        split_dir = root / split
        split_dir.mkdir(parents=True, exist_ok=True)
        keep = split_dir / ".gitkeep"
        if not keep.exists():
            keep.write_text("", encoding="utf-8")
    write_metadata(root, name=name, version=version, source=source)
    return root


def resolve_source(name: str, source: str | None) -> str:
    if source:
        return source
    if name in KNOWN_SOURCES:
        return KNOWN_SOURCES[name]
    raise ValueError(
        f"Fuente desconocida para '{name}'. Pasa --source URL "
        "o añade el nombre a KNOWN_SOURCES."
    )
