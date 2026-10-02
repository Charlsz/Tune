"""Comparación máscara vs referencia: agua nueva, persistente y retirada."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from tune.application.change import change_layers, compare
from tune.domain.analysis import ChangeSummary, HazardTask
from tune.infrastructure.analyses import FileAnalysisRepository
from tests.unit.test_analyze import FakeSegmenter, fake_output
from tune.application.analyze import AnalyzeUseCase


def _masks(h: int = 4, w: int = 5):
    mask = np.zeros((h, w), dtype=np.uint8)
    mask[0, :] = 1  # fila 0: toda agua
    mask[1, :2] = 1  # dos píxeles más
    valid = np.ones((h, w), dtype=bool)
    valid[-1, -1] = False
    reference = np.zeros((h, w), dtype=bool)
    reference[0, :3] = True  # agua permanente en 3 de la fila 0
    reference[2, 0] = True  # permanente donde no hay agua ahora (retirado)
    ref_valid = np.ones((h, w), dtype=bool)
    return mask, valid, reference, ref_valid


def test_compare_counts_new_persistent_and_receded() -> None:
    mask, valid, reference, ref_valid = _masks()
    # válidos: 19. Agua en fila0 (5) + (1,0)(1,1) = 7, pero valid[-1,-1] no afecta esas.
    # permanente en (0,0)(0,1)(0,2) y (2,0).
    # both = valid & ref_valid = 19
    # water = 7 (fila0 completa + 2)
    # new = water & ~P = (0,3)(0,4)(1,0)(1,1) = 4
    # persistent = (0,0)(0,1)(0,2) = 3
    # receded = (2,0) = 1
    summary = compare(
        mask, valid, 1, reference, ref_valid, 900.0, source="history", reference_dates=("2020-01-01",)
    )
    assert summary.new_pixels == 4
    assert summary.persistent_pixels == 3
    assert summary.receded_pixels == 1
    assert summary.compared_pixels == 19
    assert summary.new_pixels + summary.persistent_pixels == 7
    assert summary.new_area_km2 == pytest.approx(4 * 900 / 1e6)
    assert summary.reference_source == "history"
    assert summary.reference_dates == ("2020-01-01",)


def test_compare_ignores_invalid_in_either_layer() -> None:
    mask = np.ones((2, 2), dtype=np.uint8)
    valid = np.array([[True, True], [True, False]])
    reference = np.zeros((2, 2), dtype=bool)
    ref_valid = np.array([[True, False], [True, True]])
    # both = (0,0) y (1,0) → 2 píxeles. Ambos son agua nueva.
    s = compare(mask, valid, 1, reference, ref_valid, None, source="jrc_gsw_v1_4")
    assert s.compared_pixels == 2
    assert s.new_pixels == 2
    assert s.new_area_km2 is None


def test_compare_without_pixel_area_leaves_areas_none() -> None:
    mask, valid, reference, ref_valid = _masks()
    s = compare(mask, valid, 1, reference, ref_valid, None, source="history")
    assert s.new_area_km2 is None
    assert s.persistent_area_km2 is None
    assert s.receded_area_km2 is None


def test_compare_rejects_mismatched_shapes() -> None:
    with pytest.raises(ValueError, match="formas incompatibles"):
        compare(
            np.zeros((2, 2)),
            np.ones((2, 2), dtype=bool),
            1,
            np.zeros((3, 3), dtype=bool),
            np.ones((3, 3), dtype=bool),
            None,
            source="history",
        )


def test_save_with_change_layers_writes_artifacts(tmp_path: Path) -> None:
    src = tmp_path / "scene.tif"
    src.write_bytes(b"x")
    out = fake_output()
    # raster_meta vacío → no mask.tif ni reference.tif; sí change.png
    change = ChangeSummary(
        reference_source="history",
        reference_id="abc",
        reference_dates=("2021-01-01",),
        new_pixels=2,
        persistent_pixels=1,
        receded_pixels=0,
        compared_pixels=19,
        new_area_km2=0.0018,
        persistent_area_km2=0.0009,
        receded_area_km2=0.0,
    )
    from dataclasses import replace

    from tune.domain.analysis import Analysis
    from datetime import datetime, timezone
    import uuid

    analysis = Analysis(
        id=uuid.uuid4().hex[:12],
        task=HazardTask.FLOOD,
        created_at=datetime.now(timezone.utc).isoformat(),
        model_id="fake",
        input_filename="scene.tif",
        width=5,
        height=4,
        valid_pixels=19,
        affected_pixels=5,
        affected_ratio=5 / 19,
        affected_area_km2=0.0045,
        crs="EPSG:32618",
        bounds=out.bounds,
        latency_s=0.1,
        change=change,
    )
    new = np.zeros((4, 5), dtype=bool)
    new[0, :2] = True
    persistent = np.zeros((4, 5), dtype=bool)
    persistent[0, 2] = True
    receded = np.zeros((4, 5), dtype=bool)
    repo = FileAnalysisRepository(tmp_path / "analyses")
    saved = repo.save(analysis, out, src, change_layers=(new, persistent, receded))
    folder = tmp_path / "analyses" / saved.id
    assert (folder / "change.png").is_file()
    assert "change_png" in saved.artifacts
    loaded = repo.get(saved.id)
    assert loaded.change == change
    assert loaded.change.reference_dates == ("2021-01-01",)


def test_old_analysis_json_without_change_loads(tmp_path: Path) -> None:
    import json

    src = tmp_path / "x.tif"
    src.write_bytes(b"x")
    repo = FileAnalysisRepository(tmp_path / "analyses")
    a = AnalyzeUseCase(FakeSegmenter(fake_output()), repo).execute(src, HazardTask.FLOOD)
    path = tmp_path / "analyses" / a.id / "analysis.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    raw.pop("change", None)
    del raw["acquired_at"], raw["metadata"]
    path.write_text(json.dumps(raw), encoding="utf-8")
    loaded = repo.get(a.id)
    assert loaded.change is None
    assert loaded.acquired_at is None
    assert loaded.metadata == {}


def test_change_layers_match_compare_counts() -> None:
    mask, valid, reference, ref_valid = _masks()
    s = compare(mask, valid, 1, reference, ref_valid, 1.0, source="history")
    n, p, r = change_layers(mask, valid, 1, reference, ref_valid)
    assert int(n.sum()) == s.new_pixels
    assert int(p.sum()) == s.persistent_pixels
    assert int(r.sum()) == s.receded_pixels
