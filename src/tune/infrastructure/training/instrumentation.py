"""Medición de eficiencia (lo que Tune mide siempre, sin importar la tarea)."""

from __future__ import annotations

import platform
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field


@dataclass
class ResourceProbe:
    """Cronómetro + pico de memoria GPU. Usar como context manager alrededor del fit."""

    start: float = 0.0
    elapsed_s: float = 0.0
    peak_gpu_memory_mb: float | None = None
    hardware: str = field(default_factory=lambda: platform.processor() or platform.machine())

    @contextmanager
    def measure(self) -> Iterator[ResourceProbe]:
        torch = _try_import_torch()
        if torch is not None and torch.cuda.is_available():
            torch.cuda.reset_peak_memory_stats()
            self.hardware = torch.cuda.get_device_name(0)
        self.start = time.perf_counter()
        try:
            yield self
        finally:
            self.elapsed_s = time.perf_counter() - self.start
            if torch is not None and torch.cuda.is_available():
                self.peak_gpu_memory_mb = torch.cuda.max_memory_allocated() / 1024**2

    @property
    def gpu_hours(self) -> float | None:
        return self.elapsed_s / 3600 if self.peak_gpu_memory_mb is not None else None


def _try_import_torch():
    try:
        import torch  # noqa: PLC0415

        return torch
    except ImportError:
        return None
