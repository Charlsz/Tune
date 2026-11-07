"""Entrypoint Gradio Space (ZeroGPU free).

Sirve la API Tune + SPA React en ``/`` y Blocks en ``/gradio`` (requisito SDK).
Inferencia en CPU del Space; ``@spaces.GPU`` solo pasa el check de ZeroGPU.
"""

from __future__ import annotations

import os
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

import spaces  # noqa: E402
import gradio as gr  # noqa: E402
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


if __name__ == "__main__":
    _report_zerogpu_startup()
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "7860")))
