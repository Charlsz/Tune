"""Registry en disco para smoke sin servidor MLflow."""

from __future__ import annotations

import json
from pathlib import Path

from tune.domain.entities import PromotionStage, RunResult


class FileModelRegistry:
    def __init__(self, root: Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def register(self, run: RunResult, model_name: str) -> str:
        model_dir = self.root / model_name
        model_dir.mkdir(parents=True, exist_ok=True)
        versions = sorted(model_dir.glob("v*"))
        version = str(len(versions) + 1)
        entry = {
            "version": version,
            "run_id": run.run_id,
            "checkpoint_uri": run.checkpoint_uri,
            "quality": run.quality.values,
            "primary": run.quality.primary,
        }
        (model_dir / f"v{version}.json").write_text(json.dumps(entry, indent=2), encoding="utf-8")
        return version

    def set_stage(self, model_name: str, version: str, stage: PromotionStage) -> None:
        path = self.root / model_name / f"v{version}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["stage"] = stage.value
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        alias = self.root / model_name / f"alias_{stage.value}.json"
        alias.write_text(json.dumps({"version": version}, indent=2), encoding="utf-8")

    def resolve(self, model_name: str, alias: str) -> str:
        path = self.root / model_name / f"alias_{alias}.json"
        if not path.exists():
            raise FileNotFoundError(f"Alias {alias} no registrado para {model_name}")
        version = json.loads(path.read_text(encoding="utf-8"))["version"]
        vpath = self.root / model_name / f"v{version}.json"
        entry = json.loads(vpath.read_text(encoding="utf-8"))
        return str(entry["checkpoint_uri"])
