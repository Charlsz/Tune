#!/usr/bin/env python3
"""Publica Tune como Hugging Face Space gratis (Gradio + ZeroGPU).

Docker/cpu-basic ya exige PRO. La vía free es Gradio en ``zero-a10g``.

Requiere ``HF_TOKEN`` (write)::

    export HF_TOKEN=hf_...
    python3 scripts/deploy_hf_space.py --repo-id cgalvis21/tune
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


def _build_web_dist() -> Path:
    dist = ROOT / "web" / "dist"
    index = dist / "index.html"
    if index.is_file():
        return dist
    print("Construyendo web/dist…")
    subprocess.check_call(["npm", "ci", "--ignore-scripts"], cwd=ROOT / "web")
    subprocess.check_call(["npm", "run", "build"], cwd=ROOT / "web")
    return dist


def _prefetch_model(staging: Path) -> None:
    """Copia o descarga el checkpoint al staging para cold start usable."""
    cache = staging / ".hf_cache"
    local = Path(os.environ.get("HF_HOME", str(ROOT / ".hf_cache")))
    flood = (
        local
        / "hub"
        / "models--ibm-nasa-geospatial--Prithvi-EO-2.0-300M-TL-Sen1Floods11"
    )
    if flood.is_dir():
        print(f"Copiando checkpoint local {flood} → staging…")
        dest = cache / "hub" / flood.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(flood, dest, dirs_exist_ok=True)
        return
    cache.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "HF_HOME": str(cache)}
    script = SPACE_META / "prefetch_flood_model.py"
    print("Prefetch flood checkpoint → staging…")
    subprocess.check_call([sys.executable, str(script)], env=env, cwd=str(staging))


def _stage(staging: Path, *, prefetch: bool) -> None:
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)

    for name in (
        "app.py",
        "README.md",
        "requirements.txt",
        "packages.txt",
        "prefetch_flood_model.py",
    ):
        shutil.copy2(SPACE_META / name, staging / name)

    shutil.copy2(ROOT / "pyproject.toml", staging / "pyproject.toml")
    shutil.copy2(ROOT / "LICENSE", staging / "LICENSE")
    shutil.copytree(ROOT / "src", staging / "src")

    dist = _build_web_dist()
    shutil.copytree(dist, staging / "web" / "dist")

    shutil.copytree(ROOT / "artifacts" / "analyses", staging / "artifacts" / "analyses")
    shutil.copytree(ROOT / "examples", staging / "examples")

    # Instalable como paquete desde requirements (línea "-e .").
    req = (staging / "requirements.txt").read_text()
    if "-e ." not in req and ".\n" not in req:
        (staging / "requirements.txt").write_text(req.rstrip() + "\n-e .\n")

    if prefetch:
        _prefetch_model(staging)


def _hf_api(token: str):
    from huggingface_hub import HfApi  # noqa: PLC0415

    return HfApi(token=token)


def _ensure_space(api, repo_id: str, private: bool) -> None:
    from huggingface_hub import SpaceHardware  # noqa: PLC0415
    from huggingface_hub.utils import RepositoryNotFoundError  # noqa: PLC0415

    try:
        info = api.repo_info(repo_id=repo_id, repo_type="space")
        print(f"Space existente: {info.id}")
    except RepositoryNotFoundError:
        print(f"Creando Space {repo_id} (gradio + ZeroGPU, free)…")
        api.create_repo(
            repo_id=repo_id,
            repo_type="space",
            space_sdk="gradio",
            space_hardware=SpaceHardware.ZERO_A10G,
            private=private,
            exist_ok=True,
        )

    try:
        api.request_space_hardware(repo_id=repo_id, hardware=SpaceHardware.ZERO_A10G)
    except Exception as exc:  # noqa: BLE001
        print(f"Nota hardware: {exc}")


def _upload(api, repo_id: str, staging: Path) -> None:
    print(f"Subiendo {staging} → {repo_id}…")
    api.upload_folder(
        folder_path=str(staging),
        repo_id=repo_id,
        repo_type="space",
        commit_message="Deploy Tune free-tier Gradio ZeroGPU Space",
        ignore_patterns=["**/.git*", "**/__pycache__/**", "**/*.pyc"],
    )


def _space_url(repo_id: str) -> str:
    owner, name = repo_id.split("/", 1)
    host = f"{owner}-{name}".replace("_", "-").lower()
    return f"https://{host}.hf.space"


def _wait_health(url: str, timeout_s: int) -> None:
    import urllib.request  # noqa: PLC0415

    health = url.rstrip("/") + "/health"
    print(f"Esperando {health} (timeout {timeout_s}s)…")
    deadline = time.time() + timeout_s
    last = ""
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health, timeout=30) as resp:
                body = resp.read().decode()
                if resp.status == 200 and "ok" in body:
                    print(f"OK health: {body}")
                    return
                last = f"status={resp.status} body={body[:200]}"
        except Exception as exc:  # noqa: BLE001
            last = str(exc)
        time.sleep(20)
    raise SystemExit(f"Timeout esperando health. Último error: {last}")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--repo-id", default=os.environ.get("HF_SPACE_REPO", "cgalvis21/tune"))
    p.add_argument("--private", action="store_true")
    p.add_argument("--skip-wait", action="store_true")
    p.add_argument("--skip-prefetch", action="store_true")
    p.add_argument("--timeout", type=int, default=3600)
    p.add_argument("--staging", type=Path, default=None)
    args = p.parse_args()

    token = _require_token()
    api = _hf_api(token)
    who = api.whoami()
    print(f"Autenticado como {who.get('name') or who}")

    staging = args.staging or Path(tempfile.mkdtemp(prefix="tune-hf-space-"))
    print(f"Staging: {staging}")
    _stage(Path(staging), prefetch=not args.skip_prefetch)

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
