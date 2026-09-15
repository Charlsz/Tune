"""Fine-tuning de un clasificador **preentrenado** (torchvision) sobre ImageFolder.

Tune no inventa el modelo: parte de pesos ImageNet ya publicados (p. ej. ResNet18)
y solo adapta parámetros al dataset del caso.
"""

from __future__ import annotations

from pathlib import Path

from tune.domain.entities import EfficiencyMetrics, QualityMetrics, TrainingConfig
from tune.infrastructure.training.instrumentation import ResourceProbe


class ClassificationTrainer:
    def __init__(self, artifacts_dir: str, data_dir: str = "data") -> None:
        self.artifacts_dir = Path(artifacts_dir)
        self.data_dir = Path(data_dir)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)

    def train(self, config: TrainingConfig) -> tuple[str, EfficiencyMetrics]:
        import torch
        from torch import nn
        from torch.utils.data import DataLoader
        from torchvision import datasets, transforms

        torch.manual_seed(config.seed)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        train_dir = self.data_dir / config.dataset.root / "train"
        if not train_dir.exists():
            raise FileNotFoundError(
                f"No hay split train en {train_dir}. "
                "Ejecuta prepare_data con --download-cpu-smoke (ver docs/research/ComoProbar.md)."
            )

        img_size = int(config.extra.get("image_size", 64))
        tfm = transforms.Compose(
            [
                transforms.Resize((img_size, img_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )
        train_ds = datasets.ImageFolder(str(train_dir), transform=tfm)
        num_classes = len(train_ds.classes)
        if num_classes < 2:
            raise ValueError(f"Se necesitan >=2 clases en {train_dir}, hay {num_classes}")

        loader = DataLoader(
            train_ds,
            batch_size=min(config.batch_size, max(1, len(train_ds))),
            shuffle=True,
            num_workers=0,
        )

        model = build_pretrained_classifier(config.model.source, num_classes, pretrained=True)
        # Optimized / PEFT-like: congelar backbone, entrenar solo la cabeza.
        if config.peft is not None or bool(config.extra.get("freeze_backbone", False)):
            for name, param in model.named_parameters():
                if not name.startswith("fc."):
                    param.requires_grad = False

        model = model.to(device)
        trainable = [p for p in model.parameters() if p.requires_grad]
        optim = torch.optim.Adam(trainable, lr=config.learning_rate)
        loss_fn = nn.CrossEntropyLoss()

        probe = ResourceProbe()
        with probe.measure():
            model.train()
            for _ in range(config.epochs):
                for xb, yb in loader:
                    xb, yb = xb.to(device), yb.to(device)
                    optim.zero_grad(set_to_none=True)
                    loss_fn(model(xb), yb).backward()
                    optim.step()

        out = self.artifacts_dir / f"{config.strategy.value}_{config.model.name}.pt"
        torch.save(
            {
                "state_dict": model.state_dict(),
                "num_classes": num_classes,
                "classes": train_ds.classes,
                "model_source": config.model.source,
                "image_size": img_size,
            },
            out,
        )
        return out.resolve().as_uri(), EfficiencyMetrics(
            train_time_s=probe.elapsed_s,
            peak_gpu_memory_mb=probe.peak_gpu_memory_mb,
            gpu_hours=probe.elapsed_s / 3600,
            hardware=probe.hardware or str(device),
        )


class ClassificationEvaluator:
    primary_metric = "accuracy"

    def __init__(self, data_dir: str = "data") -> None:
        self.data_dir = Path(data_dir)

    def evaluate(self, checkpoint_uri: str, config: TrainingConfig) -> QualityMetrics:
        import torch
        from torch.utils.data import DataLoader
        from torchvision import datasets, transforms

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        path = _uri_to_path(checkpoint_uri)
        ckpt = torch.load(path, map_location=device, weights_only=False)

        test_dir = self.data_dir / config.dataset.root / "test"
        img_size = int(ckpt.get("image_size", config.extra.get("image_size", 64)))
        tfm = transforms.Compose(
            [
                transforms.Resize((img_size, img_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )
        test_ds = datasets.ImageFolder(str(test_dir), transform=tfm)
        loader = DataLoader(test_ds, batch_size=min(32, max(1, len(test_ds))), num_workers=0)

        model = build_pretrained_classifier(
            str(ckpt.get("model_source", config.model.source)),
            int(ckpt["num_classes"]),
            pretrained=False,
        )
        model.load_state_dict(ckpt["state_dict"])
        model.to(device).eval()

        correct = total = 0
        with torch.no_grad():
            for xb, yb in loader:
                xb, yb = xb.to(device), yb.to(device)
                pred = model(xb).argmax(dim=1)
                correct += int((pred == yb).sum().item())
                total += int(yb.numel())
        acc = correct / total if total else 0.0
        return QualityMetrics(values={"accuracy": acc}, primary="accuracy")


def build_pretrained_classifier(source: str, num_classes: int, pretrained: bool = True):
    import torch.nn as nn
    from torchvision import models

    key = source.lower().removeprefix("torchvision/")
    if key in {"resnet18", "resnet18-imagenet"}:
        weights = models.ResNet18_Weights.DEFAULT if pretrained else None
        model = models.resnet18(weights=weights)
        model.fc = nn.Linear(model.fc.in_features, num_classes)
        return model
    raise ValueError(
        f"Fuente no soportada para smoke CPU: {source}. Usa 'torchvision/resnet18'."
    )


def _uri_to_path(uri: str) -> Path:
    if uri.startswith("file:"):
        from urllib.parse import unquote, urlparse

        parsed = urlparse(uri)
        path = unquote(parsed.path)
        # urlparse en Windows puede devolver /C:/...
        if path.startswith("/") and len(path) > 2 and path[2] == ":":
            path = path[1:]
        return Path(path)
    return Path(uri)
