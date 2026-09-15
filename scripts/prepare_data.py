"""Prepara el layout versionado del dataset bajo ``data/<name>/<version>/``.

Uso:
    python scripts/prepare_data.py --name hls_burn_scars --version 1.0 --init-layout

Tras --init-layout, ``tune prepare -s baseline`` valida el layout.
La descarga masiva de tiles EO se hace en el entorno GPU; este script no la bloquea.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Permite ejecutar el script sin instalar el editable package en algunos entornos.
_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from tune.infrastructure.data.layout import init_layout, resolve_source  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--name", required=True)
    p.add_argument("--version", required=True)
    p.add_argument("--data-dir", default="data", type=Path)
    p.add_argument(
        "--init-layout",
        action="store_true",
        help="Crea train/val/test + metadata.yaml sin descargar el corpus completo.",
    )
    p.add_argument(
        "--source",
        default=None,
        help="URL de origen (opcional si el name es conocido).",
    )
    args = p.parse_args()

    try:
        source = resolve_source(args.name, args.source)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    target = args.data_dir / args.name / args.version

    if args.init_layout:
        init_layout(target, name=args.name, version=args.version, source=source)
        print(f"[prepare_data] layout OK -> {target}")
        print("Siguiente: tune prepare -s baseline")
        return

    raise SystemExit(
        "Indica --init-layout para crear el layout versionado.\n"
        "Ver data/README.md para poblar splits en el entorno de entrenamiento."
    )


if __name__ == "__main__":
    main()
