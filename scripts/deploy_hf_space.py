#!/usr/bin/env python3
"""Publica Tune como Hugging Face Space (Docker, free tier cpu-basic).

Requiere ``HF_TOKEN`` (write) en el entorno. Uso::

    export HF_TOKEN=hf_...
    python scripts/deploy_hf_space.py --repo-id Charlsz/tune

Crea el Space si no existe, sube un staging mínimo y espera a que el runtime
responda en ``/health``.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPACE_META = ROOT / "deploy" / "hf-space"


def _require_token() -> str:
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    if not token:
        print("Falta HF_TOKEN (write) en el entorno.", file=sys.stderr)
        sys.exit(2)
    return token


def _stage(staging: Path) -> None:
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)

    shutil.copy2(SPACE_META / "Dockerfile", staging / "Dockerfile")
    shutil.copy2(SPACE_META / "README.md", staging / "README.md")
    shutil.copy2(SPACE_META / ".dockerignore", staging / ".dockerignore")
    shutil.copy2(ROOT / "pyproject.toml", staging / "pyproject.toml")
    shutil.copy2(ROOT / "README.md", staging / "README.md.repo")
    shutil.copy2(ROOT / "LICENSE", staging / "LICENSE")

    # El Dockerfile espera README.md del paquete Python.
    shutil.copy2(ROOT / "README.md", staging / "README.md.pkg")
    # README del Space (YAML) debe vivir en la raíz del repo HF; el del paquete
    # se renombra solo dentro del contexto de build vía copia temporal en Docker.
    # Solución: dejar el README del Space y copiar el del repo como README.pkg
    # no — el Dockerfile hace COPY README.md. Ajustamos: usar el README del Space
    # también como readme del paquete (setuptools solo lo empaqueta).
    # Ya copiamos SPACE README.md. El COPY del Dockerfile usa ese archivo: OK.

    shutil.copytree(ROOT / "src", staging / "src", dirs_exist_ok=True)
    # Solo lo necesario para construir el front.
    web_dst = staging / "web"
    web_dst.mkdir()
    for name in ("package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "index.html"):
        shutil.copy2(ROOT / "web" / name, web_dst / name)
    shutil.copytree(ROOT / "web" / "src", web_dst / "src")
    shutil.copytree(ROOT / "web" / "public", web_dst / "public")

    shutil.copytree(ROOT / "artifacts" / "analyses", staging / "artifacts" / "analyses")
    shutil.copytree(ROOT / "examples", staging / "examples")


def _hf_api(token: str):
    from huggingface_hub import HfApi  # noqa: PLC0415

    return HfApi(token=token)


def _ensure_space(api, repo_id: str, private: bool) -> None:
    from huggingface_hub.utils import RepositoryNotFoundError  # noqa: PLC0415

    try:
        info = api.repo_info(repo_id=repo_id, repo_type="space")
        print(f"Space existente: {info.id}")
        return
    except RepositoryNotFoundError:
        pass

    print(f"Creando Space {repo_id} (docker, cpu-basic, free)…")
    api.create_repo(
        repo_id=repo_id,
        repo_type="space",
        space_sdk="docker",
        private=private,
        exist_ok=True,
    )
    # Hardware free tier.
    try:
        api.request_space_hardware(repo_id=repo_id, hardware="cpu-basic")
    except Exception as exc:  # noqa: BLE001 — hardware ya free / sin permiso
        print(f"Nota hardware: {exc}")


def _upload(api, repo_id: str, staging: Path) -> None:
    print(f"Subiendo {staging} → {repo_id}…")
    api.upload_folder(
        folder_path=str(staging),
        repo_id=repo_id,
        repo_type="space",
        commit_message="Deploy Tune free-tier Docker Space",
        ignore_patterns=["**/.git*", "**/__pycache__/**", "**/*.pyc"],
    )


def _space_url(repo_id: str) -> str:
    """Host embebido: ``Owner/name`` → ``https://owner-name.hf.space``."""
    owner, name = repo_id.split("/", 1)
    host = f"{owner}-{name}".replace("_", "-").lower()
    return f"https://{host}.hf.space"


def _wait_health(url: str, timeout_s: int) -> None:
    import urllib.error  # noqa: PLC0415
    import urllib.request  # noqa: PLC0415

    health = url.rstrip("/") + "/health"
    print(f"Esperando {health} (timeout {timeout_s}s)…")
    deadline = time.time() + timeout_s
    last = ""
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health, timeout=20) as resp:
                body = resp.read().decode()
                if resp.status == 200 and "ok" in body:
                    print(f"OK health: {body}")
                    return
                last = f"status={resp.status} body={body[:200]}"
        except Exception as exc:  # noqa: BLE001
            last = str(exc)
        time.sleep(15)
    raise SystemExit(f"Timeout esperando health. Último error: {last}")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--repo-id", default=os.environ.get("HF_SPACE_REPO", "Charlsz/tune"))
    p.add_argument("--private", action="store_true")
    p.add_argument("--skip-wait", action="store_true")
    p.add_argument("--timeout", type=int, default=1800, help="Espera build+boot (s)")
    p.add_argument("--staging", type=Path, default=None)
    args = p.parse_args()

    token = _require_token()
    api = _hf_api(token)

    who = api.whoami()
    print(f"Autenticado como {who.get('name') or who}")

    staging = args.staging or Path(tempfile.mkdtemp(prefix="tune-hf-space-"))
    print(f"Staging: {staging}")
    _stage(Path(staging))

    _ensure_space(api, args.repo_id, private=args.private)
    _upload(api, args.repo_id, Path(staging))

    url = _space_url(args.repo_id)
    print(f"URL esperada: {url}")
    print(f"Dashboard: https://huggingface.co/spaces/{args.repo_id}")

    if not args.skip_wait:
        _wait_health(url, timeout_s=args.timeout)
        smoke = ROOT / "scripts" / "smoke_hf_space.py"
        subprocess.check_call([sys.executable, str(smoke), "--base-url", url])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
