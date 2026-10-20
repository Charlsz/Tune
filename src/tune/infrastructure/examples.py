"""Escenas oficiales de los repos IBM-NASA. Lista cerrada: no se baja una URL arbitraria."""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

HF = "https://huggingface.co/ibm-nasa-geospatial"
_MAX_BYTES = 200 * 1024 * 1024
ProgressCb = Callable[[int, int], None]


class ExampleDownloadError(RuntimeError):
    """Fallo al bajar una escena oficial (red, HF caído, archivo incompleto)."""


@dataclass(frozen=True)
class ExampleScene:
    id: str
    task: str
    label: str
    filename: str
    repo: str
    size_bytes: int
    blurb: str = ""


@dataclass(frozen=True)
class RemoteMeta:
    content_length: int | None
    etag: str | None
    last_modified: str | None


CATALOG: tuple[ExampleScene, ...] = (
    ExampleScene(
        "india",
        "flood",
        "India",
        "India_900498_S2Hand.tif",
        "Prithvi-EO-2.0-300M-TL-Sen1Floods11",
        2_151_620,
        "Sen1Floods11 · inundación con agua detectada",
    ),
    ExampleScene(
        "spain",
        "flood",
        "España",
        "Spain_7370579_S2Hand.tif",
        "Prithvi-EO-2.0-300M-TL-Sen1Floods11",
        2_320_690,
        "Sen1Floods11 · escena óptica de referencia",
    ),
    ExampleScene(
        "usa",
        "flood",
        "EE. UU.",
        "USA_430764_S2Hand.tif",
        "Prithvi-EO-2.0-300M-TL-Sen1Floods11",
        2_199_014,
        "Sen1Floods11 · Kansas / cuenca del Missouri",
    ),
    ExampleScene(
        "t10seh",
        "burn_scar",
        "California T10SEH · 2018",
        "subsetted_512x512_HLS.S30.T10SEH.2018190.v1.4_merged.tif",
        "Prithvi-EO-2.0-300M-BurnScars",
        6_295_168,
        "HLS Burn Scars · tarea auxiliar",
    ),
    ExampleScene(
        "t10sff",
        "burn_scar",
        "California T10SFF · 2018",
        "subsetted_512x512_HLS.S30.T10SFF.2018190.v1.4_merged.tif",
        "Prithvi-EO-2.0-300M-BurnScars",
        6_295_168,
        "HLS Burn Scars · tarea auxiliar",
    ),
    ExampleScene(
        "t10sgf",
        "burn_scar",
        "California T10SGF · 2020",
        "subsetted_512x512_HLS.S30.T10SGF.2020217.v1.4_merged.tif",
        "Prithvi-EO-2.0-300M-BurnScars",
        6_295_168,
        "HLS Burn Scars · tarea auxiliar",
    ),
)


def by_id(example_id: str) -> ExampleScene:
    for scene in CATALOG:
        if scene.id == example_id:
            return scene
    raise KeyError(example_id)


def remote_url(scene: ExampleScene) -> str:
    return f"{HF}/{scene.repo}/resolve/main/examples/{scene.filename}"


def cached_path(scene: ExampleScene, dest_dir: Path) -> Path | None:
    dest = dest_dir / scene.filename
    if dest.is_file() and dest.stat().st_size > 0:
        return dest
    return None


def _meta_path(dest: Path) -> Path:
    return dest.with_suffix(dest.suffix + ".meta.json")


def _read_meta(dest: Path) -> dict:
    path = _meta_path(dest)
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _write_meta(dest: Path, remote: RemoteMeta, size: int) -> None:
    payload = {
        "content_length": remote.content_length or size,
        "etag": remote.etag,
        "last_modified": remote.last_modified,
        "local_size": size,
    }
    _meta_path(dest).write_text(json.dumps(payload), encoding="utf-8")


def probe_remote(scene: ExampleScene) -> RemoteMeta:
    """HEAD al archivo en Hugging Face. Si falla, meta vacía (se usa caché o se baja)."""
    req = Request(remote_url(scene), method="HEAD", headers={"User-Agent": "tune-examples"})
    try:
        with urlopen(req, timeout=30) as resp:
            cl = resp.headers.get("Content-Length")
            return RemoteMeta(
                content_length=int(cl) if cl and cl.isdigit() else None,
                etag=(resp.headers.get("ETag") or "").strip() or None,
                last_modified=resp.headers.get("Last-Modified"),
            )
    except (URLError, TimeoutError, ValueError, OSError):
        return RemoteMeta(None, None, None)


def is_stale(scene: ExampleScene, dest_dir: Path, remote: RemoteMeta | None = None) -> bool:
    """True si no hay caché o el remoto cambió respecto al meta guardado."""
    hit = cached_path(scene, dest_dir)
    if hit is None:
        return True
    meta = _read_meta(hit)
    remote = remote or probe_remote(scene)
    if remote.content_length is not None and hit.stat().st_size != remote.content_length:
        return True
    if remote.etag and meta.get("etag") and remote.etag != meta["etag"]:
        return True
    if (
        remote.last_modified
        and meta.get("last_modified")
        and remote.last_modified != meta["last_modified"]
    ):
        return True
    if remote.content_length is None and remote.etag is None:
        # Sin señal remota: confiar en tamaño del catálogo si diverge mucho.
        if abs(hit.stat().st_size - scene.size_bytes) > 1024:
            return True
        return False
    return False


def fetch(
    scene: ExampleScene,
    dest_dir: Path,
    on_progress: ProgressCb | None = None,
    *,
    refresh: bool = True,
) -> tuple[Path, bool]:
    """Baja la escena a disco.

    Si ``refresh`` es True (por defecto), consulta Hugging Face y vuelve a bajar
    cuando el archivo remoto cambió. Devuelve ``(path, downloaded)``.
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / scene.filename
    remote = probe_remote(scene) if refresh else RemoteMeta(None, None, None)
    stale = is_stale(scene, dest_dir, remote) if refresh else cached_path(scene, dest_dir) is None

    if not stale and dest.is_file() and dest.stat().st_size > 0:
        if on_progress is not None:
            size = dest.stat().st_size
            on_progress(size, size)
        return dest, False

    tmp = dest_dir / f"{scene.filename}.part"
    req = Request(remote_url(scene), headers={"User-Agent": "tune-examples"})
    try:
        with urlopen(req, timeout=180) as resp, tmp.open("wb") as fh:
            total = int(
                resp.headers.get("Content-Length") or (remote.content_length or scene.size_bytes)
            )
            etag = (resp.headers.get("ETag") or remote.etag or "").strip() or None
            last_mod = resp.headers.get("Last-Modified") or remote.last_modified
            written = 0
            if on_progress is not None:
                on_progress(0, total)
            while chunk := resp.read(256 * 1024):
                written += len(chunk)
                if written > _MAX_BYTES:
                    raise ExampleDownloadError("El ejemplo supera 200 MB")
                fh.write(chunk)
                if on_progress is not None:
                    on_progress(written, max(total, written))
            remote = RemoteMeta(total, etag, last_mod)
    except URLError as exc:
        tmp.unlink(missing_ok=True)
        # Si había caché y el refresh falló, reutilizarla.
        hit = cached_path(scene, dest_dir)
        if hit is not None:
            if on_progress is not None:
                size = hit.stat().st_size
                on_progress(size, size)
            return hit, False
        raise ExampleDownloadError(f"No se pudo bajar la escena: {exc}") from exc
    except Exception:
        tmp.unlink(missing_ok=True)
        raise
    tmp.replace(dest)
    size = dest.stat().st_size
    _write_meta(dest, remote, size)
    if on_progress is not None:
        on_progress(size, size)
    return dest, True
