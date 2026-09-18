"""Fine-tuning de segmentación EO con Prithvi (pesos HF) vía TerraTorch.

No inventamos el modelo: backbone ``prithvi_eo_v2_300`` preentrenado.
Baseline = full FT; optimized = backbone congelado (+ precision del YAML).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from tune.domain.entities import EfficiencyMetrics, QualityMetrics, TrainingConfig
from tune.infrastructure.training.instrumentation import ResourceProbe
from tune.infrastructure.training.terratorch_config import (
    freeze_backbone_for,
    write_terratorch_yaml,
)


class SegmentationTrainer:
    def __init__(self, artifacts_dir: str, data_dir: str = "data") -> None:
        self.artifacts_dir = Path(artifacts_dir)
        self.data_dir = Path(data_dir)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)

    def train(self, config: TrainingConfig) -> tuple[str, EfficiencyMetrics]:
        _require_terratorch()
        data_root = self.data_dir / config.dataset.root
        _assert_burn_scars_layout(data_root)

        run_dir = self.artifacts_dir / "eo" / config.strategy.value
        run_dir.mkdir(parents=True, exist_ok=True)
        yaml_path = write_terratorch_yaml(
            config,
            data_root=data_root,
            default_root_dir=run_dir,
            out_path=run_dir / "terratorch.yaml",
        )

        probe = ResourceProbe()
        with probe.measure():
            _run_terratorch_fit(yaml_path)

        ckpt = _find_best_checkpoint(run_dir)
        if ckpt is None:
            raise FileNotFoundError(
                f"No se encontró checkpoint Lightning bajo {run_dir}. "
                "Revisa logs de TerraTorch / CUDA / datos."
            )

        meta = {
            "task": "segmentation",
            "strategy": config.strategy.value,
            "model_source": config.model.source,
            "freeze_backbone": freeze_backbone_for(config),
            "terratorch_yaml": str(yaml_path),
            "checkpoint": str(ckpt),
            "data_root": str(data_root),
        }
        meta_path = run_dir / "tune_checkpoint.json"
        meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        # URI apunta al JSON Tune (incluye path al .ckpt Lightning)
        uri = meta_path.resolve().as_uri()

        gpu_hours = probe.elapsed_s / 3600
        return uri, EfficiencyMetrics(
            train_time_s=probe.elapsed_s,
            peak_gpu_memory_mb=probe.peak_gpu_memory_mb,
            gpu_hours=gpu_hours,
            hardware=probe.hardware,
        )


class SegmentationEvaluator:
    primary_metric = "miou"

    def __init__(self, data_dir: str = "data") -> None:
        self.data_dir = Path(data_dir)

    def evaluate(self, checkpoint_uri: str, config: TrainingConfig) -> QualityMetrics:
        _require_terratorch()
        meta = _load_tune_meta(checkpoint_uri)
        yaml_path = Path(meta["terratorch_yaml"])
        ckpt = Path(meta["checkpoint"])
        if not yaml_path.exists() or not ckpt.exists():
            raise FileNotFoundError(f"Faltan artefacts TerraTorch: yaml={yaml_path} ckpt={ckpt}")

        metrics = _run_terratorch_test(yaml_path, ckpt)
        miou = 0.0
        for key, value in metrics.items():
            low = key.lower()
            if "jaccard" in low or "miou" in low or low.endswith("/iou"):
                miou = float(value)
                break
        if "miou" in metrics:
            miou = float(metrics["miou"])
        clean = {"miou": miou}
        for k, v in metrics.items():
            if k == "miou":
                continue
            try:
                clean[k.replace("/", "_")] = float(v)
            except (TypeError, ValueError):
                continue
        return QualityMetrics(values=clean, primary="miou")


def _require_terratorch() -> None:
    try:
        import terratorch  # noqa: F401, PLC0415
    except ImportError as exc:
        raise ImportError(
            "TerraTorch es requerido para task=segmentation (Prithvi). "
            'Instala con: pip install -e ".[training]"  '
            "(incluye terratorch) o usa la imagen Docker profile training."
        ) from exc


def _assert_burn_scars_layout(data_root: Path) -> None:
    data_dir = data_root / "data"
    splits = data_root / "splits"
    need = [splits / "train.txt", splits / "val.txt", splits / "test.txt"]
    if data_dir.is_dir():
        missing = [p for p in need if not p.exists()]
        if missing:
            raise FileNotFoundError(
                "Layout Burn Scars incompleto. Faltan: "
                + ", ".join(str(p) for p in missing)
                + ". Ejecuta: python scripts/prepare_data.py "
                "--name hls_burn_scars --version 1.0 --download-burn-scars"
            )
        return
    raise FileNotFoundError(
        f"No hay {data_dir}. Descarga el dataset con --download-burn-scars "
        "(ver docs/research/ComoProbar.md sección lab universidad)."
    )


def _run_terratorch_fit(yaml_path: Path) -> None:
    cmd = [sys.executable, "-m", "terratorch", "fit", "-c", str(yaml_path)]
    proc = subprocess.run(cmd, check=False)
    if proc.returncode != 0:
        # fallback CLI entrypoint
        cmd = ["terratorch", "fit", "-c", str(yaml_path)]
        subprocess.run(cmd, check=True)


def _run_terratorch_test(yaml_path: Path, ckpt: Path) -> dict[str, float]:
    out_json = ckpt.parent / "tune_test_metrics.json"
    cmd = [
        sys.executable,
        "-m",
        "terratorch",
        "test",
        "-c",
        str(yaml_path),
        "--ckpt_path",
        str(ckpt),
    ]
    proc = subprocess.run(cmd, check=False)
    if proc.returncode != 0:
        subprocess.run(
            ["terratorch", "test", "-c", str(yaml_path), "--ckpt_path", str(ckpt)],
            check=True,
        )
    if out_json.exists():
        raw = json.loads(out_json.read_text(encoding="utf-8"))
        return {str(k): float(v) for k, v in raw.items()}
    # Si TerraTorch no escribió el JSON, intentar leer metrics.csv del trainer
    metrics_files = list(ckpt.parent.rglob("metrics.csv"))
    if metrics_files:
        return _parse_last_metrics_csv(metrics_files[-1])
    # Último recurso: marcar miou desconocido 0 — el lab debe revisar logs
    return {"miou": 0.0}


def _parse_last_metrics_csv(path: Path) -> dict[str, float]:
    import csv

    rows: list[dict[str, str]] = []
    with path.open(encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        rows.extend(reader)
    if not rows:
        return {"miou": 0.0}
    last = rows[-1]
    out: dict[str, float] = {}
    for k, v in last.items():
        if k is None or v is None or v == "":
            continue
        try:
            out[k] = float(v)
        except ValueError:
            continue
    if "miou" not in out:
        for k, v in out.items():
            if "jaccard" in k.lower() or "miou" in k.lower():
                out["miou"] = v
                break
    return out


def _find_best_checkpoint(run_dir: Path) -> Path | None:
    ckpts = sorted(run_dir.rglob("*.ckpt"), key=lambda p: p.stat().st_mtime, reverse=True)
    return ckpts[0] if ckpts else None


def _load_tune_meta(checkpoint_uri: str) -> dict:
    path = _uri_to_path(checkpoint_uri)
    if path.suffix == ".json":
        return json.loads(path.read_text(encoding="utf-8"))
    # URI directa a .ckpt
    return {
        "checkpoint": str(path),
        "terratorch_yaml": str(path.parent / "terratorch.yaml"),
    }


def _uri_to_path(uri: str) -> Path:
    if uri.startswith("file:"):
        from urllib.parse import unquote, urlparse

        parsed = urlparse(uri)
        path = unquote(parsed.path)
        if path.startswith("/") and len(path) > 2 and path[2] == ":":
            path = path[1:]
        return Path(path)
    return Path(uri)
