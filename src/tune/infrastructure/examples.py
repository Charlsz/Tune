"""Escenas oficiales de los repos IBM-NASA. Lista cerrada: no se baja una URL arbitraria."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

HF = "https://huggingface.co/ibm-nasa-geospatial"
_MAX_BYTES = 200 * 1024 * 1024


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


CATALOG: tuple[ExampleScene, ...] = (
    ExampleScene(
        "india",
        "flood",
        "India",
        "India_900498_S2Hand.tif",
        "Prithvi-EO-2.0-300M-TL-Sen1Floods11",
        2_151_620,
    ),
    ExampleScene(
        "spain",
        "flood",
        "España",
        "Spain_7370579_S2Hand.tif",
        "Prithvi-EO-2.0-300M-TL-Sen1Floods11",
        2_320_690,
    ),
    ExampleScene(
        "usa",
        "flood",
        "EE. UU.",
        "USA_430764_S2Hand.tif",
        "Prithvi-EO-2.0-300M-TL-Sen1Floods11",
        2_199_014,
    ),
    ExampleScene(
        "t10seh",
        "burn_scar",
        "California T10SEH · 2018",
        "subsetted_512x512_HLS.S30.T10SEH.2018190.v1.4_merged.tif",
        "Prithvi-EO-2.0-300M-BurnScars",
        6_295_168,
    ),
    ExampleScene(
        "t10sff",
        "burn_scar",
        "California T10SFF · 2018",
        "subsetted_512x512_HLS.S30.T10SFF.2018190.v1.4_merged.tif",
        "Prithvi-EO-2.0-300M-BurnScars",
        6_295_168,
    ),
    ExampleScene(
        "t10sgf",
        "burn_scar",
        "California T10SGF · 2020",
        "subsetted_512x512_HLS.S30.T10SGF.2020217.v1.4_merged.tif",
        "Prithvi-EO-2.0-300M-BurnScars",
        6_295_168,
    ),
)


def by_id(example_id: str) -> ExampleScene:
    for scene in CATALOG:
        if scene.id == example_id:
            return scene
    raise KeyError(example_id)


def remote_url(scene: ExampleScene) -> str:
    return f"{HF}/{scene.repo}/resolve/main/examples/{scene.filename}"


def fetch(scene: ExampleScene, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / scene.filename
    if dest.is_file() and dest.stat().st_size > 0:
        return dest
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = Request(remote_url(scene), headers={"User-Agent": "tune-examples"})
    try:
        with urlopen(req, timeout=180) as resp, tmp.open("wb") as fh:
            written = 0
            while chunk := resp.read(1024 * 1024):
                written += len(chunk)
                if written > _MAX_BYTES:
                    raise ExampleDownloadError("El ejemplo supera 200 MB")
                fh.write(chunk)
    except URLError as exc:
        tmp.unlink(missing_ok=True)
        raise ExampleDownloadError(f"No se pudo bajar la escena: {exc}") from exc
    except Exception:
        tmp.unlink(missing_ok=True)
        raise
    tmp.replace(dest)
    return dest
