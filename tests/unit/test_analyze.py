"""Caso de uso analyze + repositorio en disco, con un segmentador falso (sin torch)."""

from __future__ import annotations

import json
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


def test_use_case_keeps_acquisition_date_and_metadata(tmp_path: Path) -> None:
    src = tmp_path / "scene.tif"
    src.write_bytes(b"x")
    out = SegmentationOutput(
        **{**fake_output().__dict__, "acquired_at": "2018-07-09", "metadata": {"band_count": 6}}
    )
    repo = FileAnalysisRepository(tmp_path / "analyses")
    a = AnalyzeUseCase(FakeSegmenter(out), repo).execute(src, HazardTask.BURN_SCAR)
    assert repo.get(a.id).acquired_at == "2018-07-09"
    assert repo.get(a.id).metadata == {"band_count": 6}


def test_old_analysis_json_without_metadata_still_loads(tmp_path: Path) -> None:
    src = tmp_path / "x.tif"
    src.write_bytes(b"x")
    repo = FileAnalysisRepository(tmp_path / "analyses")
    a = AnalyzeUseCase(FakeSegmenter(fake_output()), repo).execute(src, HazardTask.FLOOD)
    path = tmp_path / "analyses" / a.id / "analysis.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    del raw["acquired_at"], raw["metadata"]
    path.write_text(json.dumps(raw), encoding="utf-8")
    loaded = repo.get(a.id)
    assert loaded.acquired_at is None
    assert loaded.metadata == {}


def test_repository_get_missing_raises(tmp_path: Path) -> None:
    with pytest.raises(KeyError):
        FileAnalysisRepository(tmp_path).get("nope")


class FakeReferenceProvider:
    def __init__(self, layer=None, *, boom: bool = False) -> None:
        self.layer = layer
        self.boom = boom
        self.calls = 0

    def reference(self, task, grid, *, exclude_id=None):
        self.calls += 1
        if self.boom:
            raise RuntimeError("referencia caída")
        return self.layer


def test_use_case_attaches_change_from_reference(tmp_path: Path) -> None:
    import numpy as np

    from tune.domain.analysis import RasterGrid, ReferenceLayer

    src = tmp_path / "scene.tif"
    src.write_bytes(b"x")
    out = fake_output()
    # grid_from_meta necesita raster_meta; sin él no pide referencia
    # Inyectamos capa vía proveedor; el use case pide grid primero.
    # Para ejercitar el camino, mockeamos grid_from_meta.
    h, w = 4, 5
    ref = np.zeros((h, w), dtype=bool)
    ref[0, :3] = True
    layer = ReferenceLayer(
        mask=ref,
        valid=np.ones((h, w), dtype=bool),
        source="history",
        reference_dates=("2020-01-01", "2020-02-01"),
    )
    provider = FakeReferenceProvider(layer)
    repo = FileAnalysisRepository(tmp_path / "analyses")

    import tune.application.analyze as analyze_mod

    real_grid = analyze_mod.grid_from_meta

    def fake_grid(meta):
        return RasterGrid(crs="EPSG:32618", transform=(30, 0, 0, 0, -30, 0), width=w, height=h)

    analyze_mod.grid_from_meta = fake_grid  # type: ignore[assignment]
    try:
        a = AnalyzeUseCase(FakeSegmenter(out), repo, reference=provider).execute(
            src, HazardTask.FLOOD
        )
    finally:
        analyze_mod.grid_from_meta = real_grid  # type: ignore[assignment]

    assert provider.calls == 1
    assert a.change is not None
    assert a.change.reference_source == "history"
    assert a.change.new_pixels + a.change.persistent_pixels == a.affected_pixels
    assert "change_png" in a.artifacts


def test_use_case_survives_reference_failure(tmp_path: Path) -> None:
    import tune.application.analyze as analyze_mod
    from tune.domain.analysis import RasterGrid

    src = tmp_path / "scene.tif"
    src.write_bytes(b"x")
    repo = FileAnalysisRepository(tmp_path / "analyses")
    provider = FakeReferenceProvider(boom=True)
    real = analyze_mod.grid_from_meta

    def fake_grid(meta):
        return RasterGrid(crs="EPSG:32618", transform=(30, 0, 0, 0, -30, 0), width=5, height=4)

    analyze_mod.grid_from_meta = fake_grid  # type: ignore[assignment]
    try:
        a = AnalyzeUseCase(FakeSegmenter(fake_output()), repo, reference=provider).execute(
            src, HazardTask.FLOOD
        )
    finally:
        analyze_mod.grid_from_meta = real  # type: ignore[assignment]
    assert a.change is None
    assert "mask_png" in a.artifacts


class FakeObservation:
    def __init__(self, layers, *, boom: bool = False) -> None:
        self.layers = layers
        self.boom = boom

    def observe(self, task, grid, *, acquired_at=None):
        if self.boom:
            raise RuntimeError("observación caída")
        return self.layers


class FakeExposure:
    def __init__(self, *, boom: bool = False) -> None:
        self.boom = boom
        self.calls = 0

    def expose(self, new_mask, valid, grid, pixel_area_m2):
        self.calls += 1
        if self.boom:
            raise RuntimeError("exposición caída")
        from tune.domain.analysis import ExposureClass, ExposureSummary

        return ExposureSummary(
            landcover_source="esa_worldcover_2021",
            population_source="ghsl_pop_2020",
            new_area_km2=0.01,
            population_exposed=12.0,
            classes=(
                ExposureClass(code=40, label="Cultivo", pixels=2, area_km2=0.01, fraction=1.0),
            ),
        )


def test_use_case_attaches_fusion_and_exposure(tmp_path: Path) -> None:
    from tune.domain.analysis import ObservationLayer, RasterGrid

    src = tmp_path / "scene.tif"
    src.write_bytes(b"x")
    out = fake_output()
    h, w = 4, 5
    ext = np.zeros((h, w), dtype=bool)
    ext[0, :] = True
    obs = FakeObservation(
        [
            ObservationLayer(
                mask=ext, valid=np.ones((h, w), dtype=bool), source="gfm", acquired_at="2024-01-01"
            )
        ]
    )
    expo = FakeExposure()
    repo = FileAnalysisRepository(tmp_path / "analyses")
    import tune.application.analyze as analyze_mod

    real = analyze_mod.grid_from_meta

    def fake_grid(meta):
        return RasterGrid(crs="EPSG:32618", transform=(30, 0, 0, 0, -30, 0), width=w, height=h)

    analyze_mod.grid_from_meta = fake_grid  # type: ignore[assignment]
    try:
        a = AnalyzeUseCase(FakeSegmenter(out), repo, observation=obs, exposure=expo).execute(
            src, HazardTask.FLOOD
        )
    finally:
        analyze_mod.grid_from_meta = real  # type: ignore[assignment]
    assert a.fusion is not None
    assert "gfm" in a.fusion.sources
    assert "fusion_png" in a.artifacts
    assert a.exposure is not None
    assert a.exposure.population_exposed == 12.0
    assert expo.calls == 1


def test_use_case_survives_observation_and_exposure_failure(tmp_path: Path) -> None:
    import tune.application.analyze as analyze_mod
    from tune.domain.analysis import RasterGrid

    src = tmp_path / "scene.tif"
    src.write_bytes(b"x")
    repo = FileAnalysisRepository(tmp_path / "analyses")
    real = analyze_mod.grid_from_meta

    def fake_grid(meta):
        return RasterGrid(crs="EPSG:32618", transform=(30, 0, 0, 0, -30, 0), width=5, height=4)

    analyze_mod.grid_from_meta = fake_grid  # type: ignore[assignment]
    try:
        a = AnalyzeUseCase(
            FakeSegmenter(fake_output()),
            repo,
            observation=FakeObservation([], boom=True),
            exposure=FakeExposure(boom=True),
        ).execute(src, HazardTask.FLOOD)
    finally:
        analyze_mod.grid_from_meta = real  # type: ignore[assignment]
    assert a.fusion is None
    assert a.exposure is None
    assert "mask_png" in a.artifacts


def test_old_analysis_json_without_fusion_still_loads(tmp_path: Path) -> None:
    src = tmp_path / "x.tif"
    src.write_bytes(b"x")
    repo = FileAnalysisRepository(tmp_path / "analyses")
    a = AnalyzeUseCase(FakeSegmenter(fake_output()), repo).execute(src, HazardTask.FLOOD)
    path = tmp_path / "analyses" / a.id / "analysis.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    raw.pop("fusion", None)
    raw.pop("exposure", None)
    path.write_text(json.dumps(raw), encoding="utf-8")
    loaded = repo.get(a.id)
    assert loaded.fusion is None
    assert loaded.exposure is None
