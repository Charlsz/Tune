"""Fusión Tune vs capas externas, sin red."""

from __future__ import annotations

import numpy as np
import pytest

from tune.application.fusion import fuse, fusion_layers
from tune.domain.analysis import ObservationLayer


def _layer(
    mask: np.ndarray, valid: np.ndarray | None = None, source: str = "gfm"
) -> ObservationLayer:
    if valid is None:
        valid = np.ones(mask.shape, dtype=bool)
    return ObservationLayer(mask=mask, valid=valid, source=source)


def test_fuse_counts_agree_and_disagreement() -> None:
    tune = np.array([[1, 1, 0], [1, 0, 0]], dtype=np.uint8)
    valid = np.ones((2, 3), dtype=bool)
    ext = np.array([[1, 0, 0], [1, 1, 0]], dtype=bool)
    summary = fuse(tune, valid, 1, [_layer(ext)], pixel_area_m2=10_000)
    assert summary is not None
    assert summary.agree_pixels == 2
    assert summary.tune_only_pixels == 1
    assert summary.external_only_pixels == 1
    assert summary.compared_pixels == 6
    assert summary.iou == pytest.approx(2 / 4)
    assert summary.agree_area_km2 == pytest.approx(0.02)
    assert "prithvi" in summary.sources and "gfm" in summary.sources


def test_fuse_unknown_when_external_has_no_data() -> None:
    tune = np.ones((2, 2), dtype=np.uint8)
    valid = np.ones((2, 2), dtype=bool)
    ext_valid = np.array([[1, 1], [0, 0]], dtype=bool)
    ext = np.array([[1, 0], [0, 0]], dtype=bool)
    summary = fuse(tune, valid, 1, [_layer(ext, ext_valid)], pixel_area_m2=None)
    assert summary is not None
    assert summary.unknown_pixels == 2
    assert summary.compared_pixels == 2
    assert summary.agree_area_km2 is None


def test_fuse_unions_two_external_layers() -> None:
    tune = np.zeros((1, 3), dtype=np.uint8)
    tune[0, 0] = 1
    valid = np.ones((1, 3), dtype=bool)
    a = _layer(np.array([[1, 0, 0]], dtype=bool), source="gfm")
    b = _layer(np.array([[0, 1, 0]], dtype=bool), source="opera_dswx_s1")
    summary = fuse(tune, valid, 1, [a, b], pixel_area_m2=None)
    assert summary is not None
    assert summary.agree_pixels == 1
    assert summary.external_only_pixels == 1
    assert summary.sources == ("prithvi", "gfm", "opera_dswx_s1")


def test_fuse_none_without_layers() -> None:
    assert fuse(np.ones((2, 2)), np.ones((2, 2), dtype=bool), 1, [], 1.0) is None


def test_fuse_rejects_mismatched_shape() -> None:
    with pytest.raises(ValueError, match="no coincide"):
        fuse(
            np.ones((2, 2)),
            np.ones((2, 2), dtype=bool),
            1,
            [_layer(np.ones((3, 3), dtype=bool))],
            None,
        )


def test_fusion_layers_four_masks() -> None:
    tune = np.array([[1, 1], [0, 0]], dtype=np.uint8)
    valid = np.ones((2, 2), dtype=bool)
    ext = np.array([[1, 0], [1, 0]], dtype=bool)
    agree, only_t, only_e, unknown = fusion_layers(tune, valid, 1, [_layer(ext)])
    assert agree.tolist() == [[True, False], [False, False]]
    assert only_t.tolist() == [[False, True], [False, False]]
    assert only_e.tolist() == [[False, False], [True, False]]
    assert not unknown.any()
