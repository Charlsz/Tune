from tune.domain.entities import PromotionStage, PromotionThresholds, QualityMetrics
from tune.domain.policies import decide_promotion


def q(v: float) -> QualityMetrics:
    return QualityMetrics(values={"miou": v}, primary="miou")


def test_rejects_below_minimum():
    assert decide_promotion(q(0.5), PromotionThresholds(0.6)) is PromotionStage.REJECTED


def test_candidate_when_above_minimum_without_baseline():
    assert decide_promotion(q(0.7), PromotionThresholds(0.6)) is PromotionStage.CANDIDATE


def test_rejects_when_drop_vs_baseline_exceeds_threshold():
    th = PromotionThresholds(min_primary_metric=0.6, max_quality_drop_vs_baseline=0.02)
    assert decide_promotion(q(0.70), th, baseline_quality=q(0.75)) is PromotionStage.REJECTED


def test_candidate_when_drop_within_threshold():
    th = PromotionThresholds(min_primary_metric=0.6, max_quality_drop_vs_baseline=0.02)
    assert decide_promotion(q(0.74), th, baseline_quality=q(0.75)) is PromotionStage.CANDIDATE


def test_never_returns_approved():
    """APPROVED es decisión humana; la política solo llega a CANDIDATE."""
    th = PromotionThresholds(min_primary_metric=0.0)
    assert decide_promotion(q(1.0), th) is PromotionStage.CANDIDATE
