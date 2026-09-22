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
from tune.infrastructure.training.instrumentation import ExternalGpuProbe
from tune.infrastructure.training.terratorch_config import (
    LOGS_DIRNAME,
    freeze_backbone_for,
    write_terratorch_yaml,
)

TERRATORCH_BIN = "terratorch"


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

        # El fit corre en subprocess: medir VRAM con nvidia-smi, no con torch.cuda.
        probe = ExternalGpuProbe()
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
            "run_dir": str(run_dir),
            "data_root": str(data_root),
        }
        meta_path = run_dir / "tune_checkpoint.json"
        meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        # URI apunta al JSON Tune (incluye path al .ckpt Lightning)
        uri = meta_path.resolve().as_uri()

        gpu_hours = probe.elapsed_s / 3600 if probe.peak_gpu_memory_mb is not None else None
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

        run_dir = Path(meta.get("run_dir") or yaml_path.parent)
        metrics = _run_terratorch_test(yaml_path, ckpt, run_dir)
        return quality_from_test_metrics(metrics)


def quality_from_test_metrics(metrics: dict[str, float]) -> QualityMetrics:
    """Convierte las métricas ``test/*`` de TerraTorch en ``QualityMetrics`` (primary=miou).

    Falla explícitamente si no hay ningún IoU: un mIoU inventado de 0.0 haría que
    register rechace y compare compare ceros sin que nadie se entere.
    """
    miou = pick_miou(metrics)
    if miou is None:
        raise RuntimeError(
            "TerraTorch test no reportó mIoU/Jaccard. Métricas vistas: "
            + (", ".join(sorted(metrics)) or "ninguna")
            + ". Revisa el metrics.csv del CSVLogger y la salida de `terratorch test`."
        )
    clean: dict[str, float] = {"miou": miou}
    for k, v in metrics.items():
        key = k.replace("/", "_")
        if key == "miou":
            continue
        try:
            clean[key] = float(v)
        except (TypeError, ValueError):
            continue
    return QualityMetrics(values=clean, primary="miou")


def pick_miou(metrics: dict[str, float]) -> float | None:
    """mIoU macro del test set. Prioridad: ``miou`` exacto > Jaccard macro > cualquier IoU.

    TerraTorch nombra ``test/Multiclass_Jaccard_Index`` (macro),
    ``..._Micro`` y ``..._<clase>`` por clase; queremos el macro.
    """
    by_low = {k.lower(): float(v) for k, v in metrics.items() if _is_number(v)}
    for key in ("miou", "test/miou", "test_miou"):
        if key in by_low:
            return by_low[key]
    for key, value in by_low.items():
        if key in {"test/multiclass_jaccard_index", "test_multiclass_jaccard_index"}:
            return value
    candidates = [
        (k, v)
        for k, v in by_low.items()
        if ("jaccard" in k or "miou" in k or "iou" in k.split("/")[-1])
        and "micro" not in k
        and k.startswith(("test/", "test_"))
    ]
    if not candidates:
        candidates = [(k, v) for k, v in by_low.items() if "jaccard" in k or "miou" in k]
    if not candidates:
        return None
    # El nombre más corto suele ser el agregado (sin sufijo de clase).
    candidates.sort(key=lambda kv: len(kv[0]))
    return candidates[0][1]


def _is_number(v: object) -> bool:
    try:
        float(v)  # type: ignore[arg-type]
        return True
    except (TypeError, ValueError):
        return False


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
                + ". Ejecuta: python lab/scripts/prepare_data.py "
                "--name hls_burn_scars --version 1.0 --download-burn-scars"
            )
        n_img = len(list(data_dir.glob("*_merged.tif")))
        n_mask = len(list(data_dir.glob("*.mask.tif")))
        if n_img == 0 or n_mask == 0:
            raise FileNotFoundError(
                f"{data_dir} no tiene pares imagen/mascara (merged={n_img}, mask={n_mask}). "
                "Borra data/hls_burn_scars/1.0 y vuelve a correr make lab-data."
            )
        return
    raise FileNotFoundError(
        f"No hay {data_dir}. Descarga el dataset con --download-burn-scars "
        "(ver lab/docs/research/ComoProbar.md sección lab universidad)."
    )


def _run_terratorch_fit(yaml_path: Path) -> None:
    # Un solo intento: si el fit falla (OOM, datos), reintentar con otro entrypoint
    # duplicaría horas de GPU para fallar igual.
    _run_checked([TERRATORCH_BIN, "fit", "-c", str(yaml_path)], what="terratorch fit")


def _run_terratorch_test(yaml_path: Path, ckpt: Path, run_dir: Path) -> dict[str, float]:
    before = set(_metrics_csvs(run_dir))
    _run_checked(
        [TERRATORCH_BIN, "test", "-c", str(yaml_path), "--ckpt_path", str(ckpt)],
        what="terratorch test",
    )
    # El test crea su propia version_N del CSVLogger; preferir la nueva.
    after = _metrics_csvs(run_dir)
    fresh = [p for p in after if p not in before] or after
    if not fresh:
        raise FileNotFoundError(
            f"terratorch test terminó pero no hay metrics.csv bajo {run_dir / LOGS_DIRNAME}. "
            "¿Se sobrescribió el logger del YAML?"
        )
    newest = max(fresh, key=lambda p: p.stat().st_mtime)
    metrics = parse_test_metrics_csv(newest)
    out_json = run_dir / "tune_test_metrics.json"
    out_json.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


def _run_checked(cmd: list[str], *, what: str) -> None:
    try:
        proc = subprocess.run(cmd, check=False)
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"No se encontró el ejecutable '{cmd[0]}'. ¿Está instalado terratorch en este "
            f"entorno? ({sys.executable})"
        ) from exc
    if proc.returncode != 0:
        raise RuntimeError(f"{what} falló con código {proc.returncode}. Revisa la salida arriba.")


def _metrics_csvs(run_dir: Path) -> list[Path]:
    logs = run_dir / LOGS_DIRNAME
    if not logs.is_dir():
        return []
    return sorted(logs.rglob("metrics.csv"))


def parse_test_metrics_csv(path: Path) -> dict[str, float]:
    """Métricas ``test/*`` del metrics.csv de Lightning.

    Lightning escribe una fila por step/epoch con muchas celdas vacías; se fusionan
    todas las filas (la última no vacía gana) y se conservan solo las columnas test/.
    Si no hubiera columnas test/ se devuelven todas las numéricas (diagnóstico).
    """
    import csv

    merged: dict[str, float] = {}
    with path.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            for k, v in row.items():
                if k is None or v is None or v == "":
                    continue
                try:
                    merged[k] = float(v)
                except ValueError:
                    continue
    test_only = {k: v for k, v in merged.items() if k.lower().startswith("test/")}
    return test_only or merged


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
