"""Reglas de negocio puras. Testeables sin GPU ni servicios."""

from __future__ import annotations

from tune.domain.entities import PromotionStage, PromotionThresholds, QualityMetrics


def decide_promotion(
    quality: QualityMetrics,
    thresholds: PromotionThresholds,
    baseline_quality: QualityMetrics | None = None,
) -> PromotionStage:
    """Decide si una corrida evaluada pasa a ``CANDIDATE`` o se rechaza.

    Reglas (plan.md, Fase 4.3):
    1. La métrica primaria debe alcanzar ``min_primary_metric``.
    2. Si hay baseline y ``max_quality_drop_vs_baseline`` está definido, la caída
       de calidad respecto al baseline no puede superar ese umbral.

    ``APPROVED`` es una decisión humana posterior (revisión del par experimental),
    por eso esta función nunca devuelve ese estado.
    """
    if quality.primary_value < thresholds.min_primary_metric:
        return PromotionStage.REJECTED

    if baseline_quality is not None and thresholds.max_quality_drop_vs_baseline is not None:
        drop = baseline_quality.primary_value - quality.primary_value
        if drop > thresholds.max_quality_drop_vs_baseline:
            return PromotionStage.REJECTED

    return PromotionStage.CANDIDATE
