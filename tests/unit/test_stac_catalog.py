"""Catálogo STAC sin red."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from tune.infrastructure.catalog.stac import CatalogError, StacCatalog, bbox_from_point


def test_bbox_from_point_is_centered() -> None:
    west, south, east, north = bbox_from_point(4.6, -74.1, 20.0)
    assert west < -74.1 < east
    assert south < 4.6 < north


def test_search_filters_and_orders(monkeypatch: pytest.MonkeyPatch) -> None:
    catalog = StacCatalog(max_km=30)

    class FakeItem:
        def __init__(self, id_: str, dt: str, cloud: float) -> None:
            self.id = id_
            self.properties = {"datetime": dt, "eo:cloud_cover": cloud}
            self.datetime = None
            self.bbox = [-75, 4, -74, 5]
            self.assets: dict = {}

    class FakeSearch:
        def items(self):
            return [
                FakeItem("a", "2024-01-02T10:00:00Z", 10),
                FakeItem("b", "2024-01-05T10:00:00Z", 50),
                FakeItem("c", "2024-01-03T10:00:00Z", 5),
            ]

    class FakeClient:
        def search(self, **kwargs):
            return FakeSearch()

    monkeypatch.setattr(catalog, "_client", lambda: FakeClient())
    items = catalog.search(4.6, -74.1, "2024-01-01", "2024-01-10", max_cloud=40)
    assert [i.id for i in items] == ["c", "a"]


def test_search_rejects_oversized_bbox() -> None:
    with pytest.raises(CatalogError, match="máximo"):
        StacCatalog(max_km=10).search(0, 0, "2024-01-01", "2024-01-02", side_km=20)


def test_fetch_six_bands_with_local_cogs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    rasterio = pytest.importorskip("rasterio")
    from rasterio.transform import from_origin

    catalog = StacCatalog()
    paths: dict[str, Path] = {}
    for name in ("blue", "green", "red", "nir08", "swir16", "swir22", "scl"):
        path = tmp_path / f"{name}.tif"
        data = np.full((20, 20), 2000 if name != "scl" else 4, dtype=np.uint16)
        if name == "scl":
            data[0:5, 0:5] = 9  # nube
        profile = {
            "driver": "GTiff",
            "height": 20,
            "width": 20,
            "count": 1,
            "dtype": data.dtype,
            "crs": "EPSG:32618",
            "transform": from_origin(500_000, 500_400, 20, 20),
        }
        with rasterio.open(path, "w", **profile) as dst:
            dst.write(data, 1)
        paths[name] = path

    class FakeAsset:
        def __init__(self, href: str) -> None:
            self.href = href
            self.extra_fields: dict = {}

    class FakeItem:
        id = "S2A_MSIL2A_20230615T150000_R123"
        properties = {"datetime": "2023-06-15T15:00:00Z"}
        datetime = None
        assets = {k: FakeAsset(str(v)) for k, v in paths.items()}

    class FakeSearch:
        def items(self):
            return [FakeItem()]

    class FakeClient:
        def search(self, **kwargs):
            return FakeSearch()

    monkeypatch.setattr(catalog, "_client", lambda: FakeClient())

    def read_window(href: str, bbox, res_m: float):
        with rasterio.open(href) as src:
            return src.read(1).astype(np.float32), src.transform, src.crs

    monkeypatch.setattr(catalog, "_read_window", read_window)
    out = catalog.fetch_six_bands(
        "S2A_MSIL2A_20230615T150000_R123",
        (-75.0, 4.0, -74.0, 5.0),
        tmp_path / "out",
    )
    assert out.is_file()
    assert "20230615T" in out.name
    with rasterio.open(out) as src:
        assert src.count == 6
        band = src.read(1)
        # offset -1000 (fecha >= 2022-01-25): DN 2000 → 1000; nubes → -9999
        assert band.max() == pytest.approx(1000)
        assert (band == -9999).any()
        assert "ACQUISITION_DATE" in src.tags()
