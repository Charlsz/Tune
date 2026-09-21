"""Medición de eficiencia (lo que Tune mide siempre, sin importar la tarea)."""

from __future__ import annotations

import platform
import subprocess
import threading
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


@dataclass
class ExternalGpuProbe:
    """Cronómetro + pico de VRAM para un entrenamiento que corre en OTRO proceso.

    ``torch.cuda.max_memory_allocated()`` solo ve el proceso actual, así que cuando el
    fit se lanza por subprocess (TerraTorch CLI) hay que muestrear ``nvidia-smi``.
    Además evita inicializar CUDA en el padre (que robaría VRAM al hijo).
    """

    poll_s: float = 2.0
    gpu_index: int = 0
    start: float = 0.0
    elapsed_s: float = 0.0
    peak_gpu_memory_mb: float | None = None
    hardware: str = field(default_factory=lambda: platform.processor() or platform.machine())
    _stop: threading.Event = field(default_factory=threading.Event, repr=False)
    _thread: threading.Thread | None = field(default=None, repr=False)
    _peak: float = field(default=-1.0, repr=False)

    @contextmanager
    def measure(self) -> Iterator[ExternalGpuProbe]:
        name = query_nvidia_smi("name", self.gpu_index)
        if name:
            self.hardware = name
        baseline = _to_float(query_nvidia_smi("memory.used", self.gpu_index))
        self._stop.clear()
        if baseline is not None:
            self._thread = threading.Thread(target=self._poll, daemon=True)
            self._thread.start()
        self.start = time.perf_counter()
        try:
            yield self
        finally:
            self.elapsed_s = time.perf_counter() - self.start
            self._stop.set()
            if self._thread is not None:
                self._thread.join(timeout=self.poll_s * 2)
            if self._peak >= 0 and baseline is not None:
                # Pico atribuible al entrenamiento (restamos lo que ya estaba en uso).
                self.peak_gpu_memory_mb = max(0.0, self._peak - baseline)

    def _poll(self) -> None:
        while not self._stop.is_set():
            used = _to_float(query_nvidia_smi("memory.used", self.gpu_index))
            if used is not None and used > self._peak:
                self._peak = used
            self._stop.wait(self.poll_s)


def query_nvidia_smi(field_name: str, gpu_index: int = 0) -> str | None:
    """Una consulta ``nvidia-smi --query-gpu``; ``None`` si no hay driver/GPU."""
    try:
        out = subprocess.run(
            [
                "nvidia-smi",
                f"--id={gpu_index}",
                f"--query-gpu={field_name}",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if out.returncode != 0:
        return None
    value = out.stdout.strip().splitlines()
    return value[0].strip() if value else None


def _to_float(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _try_import_torch():
    try:
        import torch  # noqa: PLC0415

        return torch
    except ImportError:
        return None
