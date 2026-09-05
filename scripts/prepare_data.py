"""Descarga y organiza el dataset del caso de estudio en ``data/<name>/<version>/``.

Uso (Fase 1.1):
    python scripts/prepare_data.py --name hls_burn_scars --version 1.0

Debe dejar:
    data/hls_burn_scars/1.0/{train,val,test}/...
    data/hls_burn_scars/1.0/metadata.yaml   (fuente, fecha, checksum, licencia)

Esqueleto: la descarga concreta depende del caso elegido (ADR 001).
"""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--name", required=True)
    p.add_argument("--version", required=True)
    p.add_argument("--data-dir", default="data", type=Path)
    args = p.parse_args()

    target = args.data_dir / args.name / args.version
    target.mkdir(parents=True, exist_ok=True)
    raise SystemExit(
        f"TODO(fase 1): implementar descarga de '{args.name}' v{args.version} en {target}. "
        "Ver data/README.md."
    )


if __name__ == "__main__":
    main()
