"""Serie temporal pura."""

from tune.application.series import series
from tune.domain.analysis import Analysis, ChangeSummary, GeoBounds, HazardTask


def _a(id_: str, date: str, *, new: float | None = None, affected: float | None = 1.0) -> Analysis:
    change = None
    if new is not None:
        change = ChangeSummary(
            reference_source="history",
            reference_id=None,
            reference_dates=(),
            new_pixels=1,
            persistent_pixels=0,
            receded_pixels=0,
            compared_pixels=10,
            new_area_km2=new,
            persistent_area_km2=0.0,
            receded_area_km2=0.0,
        )
    return Analysis(
        id=id_,
        task=HazardTask.FLOOD,
        created_at=f"{date}T12:00:00+00:00",
        model_id="fake",
        input_filename=f"{date}.tif",
        width=10,
        height=10,
        valid_pixels=100,
        affected_pixels=10,
        affected_ratio=0.1,
        affected_area_km2=affected,
        crs="EPSG:4326",
        bounds=GeoBounds(-75, 4, -74, 5),
        latency_s=1.0,
        acquired_at=date,
        change=change,
    )


def test_series_orders_by_acquisition_date() -> None:
    points = series([_a("b", "2020-02-01", new=2.0), _a("a", "2020-01-01", new=1.0)])
    assert [p.analysis_id for p in points] == ["a", "b"]
    assert points[0].new_km2 == 1.0
    assert points[1].date == "2020-02-01"
