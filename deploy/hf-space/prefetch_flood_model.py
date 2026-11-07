"""Descarga el checkpoint Sen1Floods11 al HF_HOME de la imagen."""

from __future__ import annotations

from huggingface_hub import hf_hub_download

REPO = "ibm-nasa-geospatial/Prithvi-EO-2.0-300M-TL-Sen1Floods11"
FILES = ("config.yaml", "Prithvi-EO-V2-300M-TL-Sen1Floods11.pt")


def main() -> None:
    for name in FILES:
        path = hf_hub_download(repo_id=REPO, filename=name)
        print(f"cached {name} -> {path}", flush=True)


if __name__ == "__main__":
    main()
