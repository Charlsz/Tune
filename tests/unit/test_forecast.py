"""Cálculo de riesgo futuro, sin red."""

from tune.infrastructure.forecast import (
    HDW_ALTO,
    HDW_EXTREMO,
    HDW_MEDIO,
    ensemble_members,
    flood_probability,
    hdw_daily,
    hdw_level,
    percentile90,
    worst_level,
)


def test_flood_probability_counts_members_over_the_threshold() -> None:
    members = [
        [11.0, 0.0],
        [0.0, 12.0],
        [0.0, 0.0],
    ]
    daily, horizon = flood_probability(members, threshold=10)
    assert daily == [1 / 3, 1 / 3]
    assert horizon == 2 / 3


def test_flood_probability_skips_missing_hours() -> None:
    daily, horizon = flood_probability([[11.0, None], [None, None]], threshold=10)
    assert daily == [1.0, 0.0]
    assert horizon == 1.0
    assert flood_probability([], threshold=1) == ([], 0.0)


def test_percentile90_of_a_short_series() -> None:
    assert percentile90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) == 9.1
    assert percentile90([4.0]) == 4.0


def test_hdw_daily_converts_kpa_and_keeps_the_windiest_dry_hour() -> None:
    times = ["2026-09-01T10:00", "2026-09-01T15:00", "2026-09-02T15:00"]
    # 1 kPa = 10 hPa. 10 hPa × 5 m/s = 50; la hora de las 10 no gana.
    days = hdw_daily(times, [1.0, 2.0, None], [5.0, 4.0, 20.0])
    assert days == [("2026-09-01", 80.0)]


def test_hdw_level_uses_the_absolute_cuts() -> None:
    assert hdw_level(HDW_MEDIO - 0.1) == "bajo"
    assert hdw_level(HDW_MEDIO) == "medio"
    assert hdw_level(HDW_ALTO) == "alto"
    assert hdw_level(HDW_EXTREMO) == "extremo"
    assert worst_level(["bajo", "alto", "medio"]) == "alto"
    assert worst_level([]) is None


def test_ensemble_members_ignores_the_mean_series() -> None:
    daily = {
        "river_discharge": [1.0],
        "river_discharge_member02": [3.0],
        "river_discharge_member01": [2.0],
    }
    assert ensemble_members(daily) == [[2.0], [3.0]]
