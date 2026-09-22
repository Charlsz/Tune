"""Caso de uso analyze + repositorio en disco, con un segmentador falso (sin torch)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from tune.application.analyze import AnalyzeUseCase, compute_stats
from tune.domain.analysis import GeoBounds, HazardTask, SegmentationOutput
from tune.infrastructure.analyses import FileAnalysisRepository


def fake_output(*, h: int = 4, w: int = 5, positive_rows: int = 1) -> SegmentationOutput:
    mask = np.zeros((h, w), dtype=np.uint8)
    mask[:positive_rows] = 1
    valid = np.ones((h, w), dtype=bool)
    valid[-1, -1] = False  # un píxel sin dato
    return SegmentationOutput(
        mask=mask,
        valid=valid,
        model_id="fake/prithvi",
        positive_class=1,
        class_names=("no", "yes"),
        crs="EPSG:32618",
        bounds=GeoBounds(west=-75.0, south=4.0, east=-74.9, north=4.1),
        pixel_area_m2=900.0,  # 30 m
        raster_meta={},
        rgb_preview=np.zeros((3, h, w), dtype=np.uint8),
    )


class FakeSegmenter:
    def __init__(self, output: SegmentationOutput) -> None:
        self.output = output
        self.calls: list[tuple[Path, HazardTask]] = []

    def segment(self, geotiff: Path, task: HazardTask) -> SegmentationOutput:
        self.calls.append((geotiff, task))
        return self.output


def test_compute_stats_counts_only_valid_positive_pixels() -> None:
    stats = compute_stats(fake_output(h=4, w=5, positive_rows=1))
    assert (stats.width, stats.height) == (5, 4)
    assert stats.valid_pixels == 19
    assert stats.affected_pixels == 5
    assert stats.affected_ratio == pytest.approx(5 / 19)
    assert stats.affected_area_km2 == pytest.approx(5 * 900 / 1e6)


def test_compute_stats_without_pixel_area() -> None:
    out = fake_output()
    out = SegmentationOutput(**{**out.__dict__, "pixel_area_m2": None})
    assert compute_stats(out).affected_area_km2 is None


def test_use_case_persists_analysis_and_artifacts(tmp_path: Path) -> None:
    src = tmp_path / "scene.tif"
    src.write_bytes(b"not-a-real-tif")
    repo = FileAnalysisRepository(tmp_path / "analyses")
    seg = FakeSegmenter(fake_output())

    a = AnalyzeUseCase(seg, repo).execute(src, HazardTask.FLOOD)

    assert seg.calls == [(src, HazardTask.FLOOD)]
    assert a.task is HazardTask.FLOOD
    assert a.input_filename == "scene.tif"
    assert set(a.artifacts) >= {"input", "mask_png", "preview_png"}
    folder = tmp_path / "analyses" / a.id
    assert (folder / "analysis.json").is_file()
    assert (folder / "mask.png").stat().st_size > 0
    assert (folder / "preview.png").stat().st_size > 0

    loaded = repo.get(a.id)
    assert loaded == a
    assert repo.list() == [a]
    assert repo.artifact_path(a.id, "mask_png") == folder / "mask.png"


def test_repository_list_is_newest_first_and_limited(tmp_path: Path) -> None:
    repo = FileAnalysisRepository(tmp_path)
    src = tmp_path / "x.tif"
    src.write_bytes(b"x")
    uc = AnalyzeUseCase(FakeSegmenter(fake_output()), repo)
    ids = [uc.execute(src, HazardTask.BURN_SCAR).id for _ in range(3)]
    listed = repo.list(limit=2)
    assert len(listed) == 2
    assert listed[0].id == ids[-1]


def test_repository_get_missing_raises(tmp_path: Path) -> None:
    with pytest.raises(KeyError):
        FileAnalysisRepository(tmp_path).get("nope")
