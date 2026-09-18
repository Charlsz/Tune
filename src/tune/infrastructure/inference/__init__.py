"""Predictor desde registry: clasificación real; segmentación reporta metadatos Tune."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from tune.domain.ports import ModelRegistry


class RegistryPredictor:
    def __init__(self, registry: ModelRegistry, model_name: str, alias: str) -> None:
        self._uri = registry.resolve(model_name, alias)
        self._path = _uri_to_path(self._uri)
        self._version = self._path.name

    @property
    def model_version(self) -> str:
        return self._version

    def predict(self, payload: Any) -> Any:
        path = self._path
        if path.suffix == ".json" and path.exists():
            meta = json.loads(path.read_text(encoding="utf-8"))
            if meta.get("task") == "segmentation":
                return {
                    "task": "segmentation",
                    "status": "model_registered",
                    "checkpoint": meta.get("checkpoint"),
                    "message": (
                        "Modelo EO registrado. Para máscara geotiff usa el checkpoint "
                        "TerraTorch en el lab (ver docs/research/ComoProbar.md)."
                    ),
                    "bytes_received": len(payload)
                    if isinstance(payload, (bytes, bytearray))
                    else None,
                }
        if path.suffix == ".pt" and path.exists():
            try:
                return _predict_classification(path, payload)
            except ImportError as exc:
                raise NotImplementedError(
                    "Predict classification requiere torch/torchvision en la imagen API."
                ) from exc
        raise NotImplementedError(
            f"Predict no soportado para artefacto {path}. "
            "Espera classification .pt o tune_checkpoint.json de segmentación."
        )


def _predict_classification(path: Path, payload: Any) -> dict[str, Any]:
    import io

    import torch
    from PIL import Image
    from torchvision import transforms

    from tune.infrastructure.training.classification_trainer import build_pretrained_classifier

    if not isinstance(payload, (bytes, bytearray)):
        raise TypeError("Predict classification espera bytes de imagen")

    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    img_size = int(ckpt.get("image_size", 64))
    tfm = transforms.Compose(
        [
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    image = Image.open(io.BytesIO(payload)).convert("RGB")
    xb = tfm(image).unsqueeze(0)
    model = build_pretrained_classifier(
        str(ckpt.get("model_source", "torchvision/resnet18")),
        int(ckpt["num_classes"]),
        pretrained=False,
    )
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    with torch.no_grad():
        logits = model(xb)
        prob = torch.softmax(logits, dim=1)[0]
        idx = int(prob.argmax().item())
    classes = ckpt.get("classes") or [str(i) for i in range(len(prob))]
    return {
        "task": "classification",
        "label": classes[idx],
        "index": idx,
        "confidence": float(prob[idx].item()),
    }


def _uri_to_path(uri: str) -> Path:
    if uri.startswith("file:"):
        parsed = urlparse(uri)
        path = unquote(parsed.path)
        if path.startswith("/") and len(path) > 2 and path[2] == ":":
            path = path[1:]
        return Path(path)
    return Path(uri)
