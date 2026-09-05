import pytest

from tune.domain.entities import Strategy
from tune.infrastructure.config import YamlConfigRepository
from tune.infrastructure.config.yaml_repository import parse_training_config


def test_loads_both_strategies_from_repo_configs(configs_dir):
    repo = YamlConfigRepository(configs_dir)
    base = repo.load_training_config("baseline")
    opt = repo.load_training_config("optimized")

    assert base.strategy is Strategy.BASELINE
    assert opt.strategy is Strategy.OPTIMIZED
    assert base.peft is None
    assert opt.peft is not None and opt.peft["method"] == "lora"


def test_strategies_share_everything_except_the_optimization(configs_dir):
    """Regla de configs/README.md: solo cambia lo que explica el ahorro."""
    repo = YamlConfigRepository(configs_dir)
    base = repo.load_training_config("baseline")
    opt = repo.load_training_config("optimized")

    assert base.dataset == opt.dataset
    assert base.model == opt.model
    assert (base.seed, base.epochs, base.batch_size, base.learning_rate) == (
        opt.seed,
        opt.epochs,
        opt.batch_size,
        opt.learning_rate,
    )


def test_loads_thresholds(configs_dir):
    th = YamlConfigRepository(configs_dir).load_thresholds()
    assert 0 < th.min_primary_metric <= 1


def test_missing_section_fails_early():
    with pytest.raises(ValueError, match="Falta la sección"):
        parse_training_config({"dataset": {}}, "baseline")


def test_missing_file_is_explicit(tmp_path):
    with pytest.raises(FileNotFoundError):
        YamlConfigRepository(tmp_path).load_training_config("baseline")
