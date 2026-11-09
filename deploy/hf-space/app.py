"""Entrypoint Gradio Space (ZeroGPU free).

Sirve la API Tune + SPA React en ``/`` y Blocks en ``/gradio`` (requisito SDK).
Inferencia en CPU del Space; ``@spaces.GPU`` solo pasa el check de ZeroGPU.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

os.environ.setdefault("TUNE_WEB_DIST", str(ROOT / "web" / "dist"))
os.environ.setdefault("TUNE_ARTIFACTS_DIR", str(ROOT / "artifacts"))
os.environ.setdefault("TUNE_TRACKER", "json")
os.environ.setdefault("TUNE_DEVICE", "cpu")
os.environ.setdefault("TUNE_CORS_ORIGINS", "*")
os.environ.setdefault("TUNE_DEFER_SPA", "1")
os.environ.setdefault("HF_HOME", str(ROOT / ".hf_cache"))
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")

# Spaces a veces no instala ``-e .``; el código vive en /app/src.
sys.path.insert(0, str(ROOT / "src"))


def _patch_torchgeo_for_py310() -> None:
    """Gradio Spaces usan Python 3.10 → torchgeo≤0.6.2.

    terratorch 1.2.11 referencia ``SENTINEL2_ALL_SOFTCON`` (torchgeo≥0.7,
    requiere Py≥3.11). Alias a MOCO para que el import no falle.
    """
    try:
        from torchgeo.models import ResNet50_Weights  # noqa: PLC0415
    except Exception as exc:  # noqa: BLE001
        print(f"torchgeo patch skipped: {exc}", flush=True)
        return
    if not hasattr(ResNet50_Weights, "SENTINEL2_ALL_SOFTCON"):
        ResNet50_Weights.SENTINEL2_ALL_SOFTCON = ResNet50_Weights.SENTINEL2_ALL_MOCO
        print("patched ResNet50_Weights.SENTINEL2_ALL_SOFTCON → MOCO", flush=True)


_patch_torchgeo_for_py310()

import gradio as gr  # noqa: E402
import spaces  # noqa: E402
import uvicorn  # noqa: E402

from tune.interfaces.api.main import app as fastapi_app  # noqa: E402
from tune.interfaces.api.main import mount_spa  # noqa: E402


@spaces.GPU
def _zerogpu_platform_check() -> str:
    """No se llama. ZeroGPU exige al menos un ``@spaces.GPU`` al arrancar."""
    return "ok"


with gr.Blocks(title="Tune") as demo:
    gr.Markdown(
        "# Tune\n\n"
        "Análisis de inundación con Prithvi-EO 2.0.\n\n"
        "Abre la [aplicación principal](/) (SPA + API)."
    )


# Gradio primero; SPA catch-all al final para no comerse /gradio.
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio", ssr_mode=False)
mount_spa(app, Path(os.environ["TUNE_WEB_DIST"]))


def _report_zerogpu_startup() -> None:
    if not getattr(spaces.config.Config, "zero_gpu", False):
        return
    try:
        spaces.zero.startup()
    except Exception as exc:  # noqa: BLE001
        print(f"ZeroGPU startup report: {exc}", flush=True)


def _warm_model_cache() -> None:
    """Descarga el checkpoint en background (repo Space free ≤1GB; el .pt son 1.2GB)."""
    try:
        from huggingface_hub import hf_hub_download  # noqa: PLC0415

        repo = "ibm-nasa-geospatial/Prithvi-EO-2.0-300M-TL-Sen1Floods11"
        for name in ("config.yaml", "Prithvi-EO-V2-300M-TL-Sen1Floods11.pt"):
            path = hf_hub_download(repo_id=repo, filename=name)
            print(f"warmed {name} -> {path}", flush=True)
    except Exception as exc:  # noqa: BLE001
        print(f"model warm skipped: {exc}", flush=True)


if __name__ == "__main__":
    import threading

    _report_zerogpu_startup()
    threading.Thread(target=_warm_model_cache, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "7860")))
