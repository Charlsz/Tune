"""Helpers puros del adaptador Prithvi (sin torch/terratorch/rasterio)."""

from __future__ import annotations

import numpy as np
import pytest

from tune.domain.analysis import HazardTask
from tune.infrastructure.inference.prithvi import (
    MODEL_CARDS,
    _temporal_coords,
    prepare_prithvi_input,
    rgb_indices_from_config,
    rgb_preview,
    select_prithvi_bands,
)


def test_select_bands_passthrough_when_six() -> None:
    r = np.zeros((6, 2, 2))
    assert select_prithvi_bands(r, MODEL_CARDS[HazardTask.BURN_SCAR]) is r


def test_select_bands_from_sentinel2_l1c_for_flood() -> None:
    r = np.arange(13)[:, None, None] * np.ones((13, 2, 2))
    out = select_prithvi_bands(r, MODEL_CARDS[HazardTask.FLOOD])
    assert out.shape[0] == 6
    assert list(out[:, 0, 0]) == [1, 2, 3, 8, 11, 12]


def test_select_bands_rejects_wrong_count() -> None:
    with pytest.raises(ValueError, match="6"):
        select_prithvi_bands(np.zeros((4, 2, 2)), MODEL_CARDS[HazardTask.BURN_SCAR])


def test_prepare_scales_reflectance_dn_with_spatial_mask() -> None:
    # Reproduce el fallo de la demo: data (6,H,W) + valid (H,W).
    data = np.full((6, 8, 8), 2500.0, dtype=np.float64)
    valid = np.ones((8, 8), dtype=bool)
    valid[0, 0] = False
    data[:, 0, 0] = -9999
    out = prepare_prithvi_input(data, valid)
    assert out.dtype == np.float32
    assert out.shape == (6, 8, 8)
    assert out[0, 0, 0] == 0.0
    assert abs(float(out[0, 1, 1]) - 0.25) < 1e-5


def test_prepare_leaves_already_normalized() -> None:
    data = np.full((6, 4, 4), 0.3, dtype=np.float32)
    valid = np.ones((4, 4), dtype=bool)
    out = prepare_prithvi_input(data, valid)
    assert abs(float(out.mean()) - 0.3) < 1e-6


def test_rgb_indices_from_burn_scars_config() -> None:
    cfg = {"data": {"init_args": {"rgb_indices": [2, 1, 0]}}}
    assert rgb_indices_from_config(cfg) == (2, 1, 0)


def test_rgb_indices_from_flood_config_bands() -> None:
    cfg = {"data": {"init_args": {"bands": ["BLUE", "GREEN", "RED", "NIR", "SWIR1", "SWIR2"]}}}
    assert rgb_indices_from_config(cfg) == (2, 1, 0)


def test_rgb_preview_shape_and_range() -> None:
    data = np.random.default_rng(0).random((6, 8, 8)).astype("float32")
    valid = np.ones((8, 8), dtype=bool)
    valid[0, 0] = False
    img = rgb_preview(data, valid, (2, 1, 0))
    assert img.shape == (3, 8, 8)
    assert img.dtype == np.uint8
    assert tuple(img[:, 0, 0]) == (0, 0, 0)


def test_temporal_coords_from_filename() -> None:
    assert _temporal_coords("S2_20200315T101031.tif") == [[2020, 75]]
    assert _temporal_coords("no-date.tif") is None


def test_affine_coeffs_and_bounds_from_floats() -> None:
    from types import SimpleNamespace

    from tune.infrastructure.inference.prithvi import _affine_coeffs, _bounds_wgs84

    # Affine-like: solo atributos a..f (como el que rompe al indexar en affine 3).
    t = SimpleNamespace(a=0.01, b=0.0, c=-75.5, d=0.0, e=-0.01, f=10.5)
    assert _affine_coeffs(t) == (0.01, 0.0, -75.5, 0.0, -0.01, 10.5)

    class _Crs:
        def to_epsg(self):
            return 4326

    src = SimpleNamespace(transform=t, width=100, height=50, crs=_Crs())
    b = _bounds_wgs84(src)
    assert abs(b.west - (-75.5)) < 1e-9
    assert abs(b.east - (-74.5)) < 1e-9
    assert abs(b.north - 10.5) < 1e-9
    assert abs(b.south - 10.0) < 1e-9


def test_patch_torch_mps_adds_is_available(monkeypatch) -> None:
    import types

    import tune.infrastructure.inference.prithvi as prithvi

    fake_torch = types.SimpleNamespace(mps=types.SimpleNamespace())
    monkeypatch.setattr(prithvi, "_import", lambda name: fake_torch if name == "torch" else None)
    prithvi._patch_torch_mps()
    assert fake_torch.mps.is_available() is False
