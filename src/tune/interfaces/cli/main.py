"""CLI ``tune``: un subcomando por stage + ``run`` para el pipeline completo (ADR 002).

tune prepare --strategy baseline
tune train   --strategy optimized
tune run     --strategy baseline --strategy optimized
"""

from __future__ import annotations

import typer

from tune import __version__
from tune.domain.entities import Strategy

app = typer.Typer(
    name="tune",
    help="Laboratorio MLOps para fine-tuning eficiente (baseline vs optimized).",
    no_args_is_help=True,
)

StrategyOpt = typer.Option("baseline", "--strategy", "-s", help="baseline | optimized")


def _container():
    from tune.infrastructure.container import Container  # noqa: PLC0415

    return Container()


def _version_callback(value: bool) -> None:
    if value:
        typer.echo(f"tune {__version__}")
        raise typer.Exit()


@app.callback()
def _root(
    version: bool = typer.Option(
        False,
        "--version",
        help="Muestra la version y sale.",
        callback=_version_callback,
        is_eager=True,
    ),
) -> None:
    """Salida en ASCII: las consolas Windows con cp1252 no soportan flechas ni letras griegas."""


@app.command()
def prepare(strategy: str = StrategyOpt) -> None:
    """Stage 1: valida el dataset declarado en la config de la estrategia."""
    c = _container()
    cfg = c.configs.load_training_config(strategy)
    c.prepare.execute(cfg.dataset)
    typer.secho(f"[prepare] dataset '{cfg.dataset.name}' v{cfg.dataset.version} OK", fg="green")


@app.command()
def train(strategy: str = StrategyOpt) -> None:
    """Stage 2: fine-tuning con la estrategia indicada; deja el run en MLflow."""
    c = _container()
    cfg = c.configs.load_training_config(strategy)
    run_id = c.train.execute(cfg)
    typer.secho(f"[train] {strategy} -> run_id={run_id}", fg="green")


@app.command()
def evaluate(run_id: str, strategy: str = StrategyOpt) -> None:
    """Stage 3: metricas de calidad sobre el test set para un run."""
    c = _container()
    cfg = c.configs.load_training_config(strategy)
    q = c.evaluate.execute(run_id, cfg)
    typer.secho(f"[evaluate] {q.primary}={q.primary_value:.4f} {q.values}", fg="green")


@app.command()
def register(run_id: str) -> None:
    """Stage 4: aplica thresholds y promueve o rechaza en el Model Registry."""
    c = _container()
    decision = c.register.execute(run_id, c.configs.load_thresholds())
    typer.secho(f"[register] run {run_id} -> {decision.value}", fg="green")


@app.command()
def compare(baseline_run_id: str, optimized_run_id: str) -> None:
    """Stage 5: confronta baseline vs optimized (eficiencia y calidad)."""
    c = _container()
    r = c.compare.execute(baseline_run_id, optimized_run_id)
    typer.echo(
        f"[compare] ahorro de tiempo: {r.time_saving_ratio:+.1%} | "
        f"delta calidad ({r.baseline.quality.primary}): {r.quality_delta:+.4f}"
    )


@app.command()
def run(
    strategy: list[str] = typer.Option(
        ["baseline", "optimized"], "--strategy", "-s", help="Estrategias a ejecutar, en orden."
    ),
) -> None:
    """Pipeline completo: prepare -> train -> evaluate -> register -> compare."""
    c = _container()
    thresholds = c.configs.load_thresholds()
    run_ids: dict[Strategy, str] = {}
    baseline_quality = None

    for name in strategy:
        st = Strategy(name)
        cfg = c.configs.load_training_config(st.value)
        c.prepare.execute(cfg.dataset)
        run_id = c.train.execute(cfg)
        quality = c.evaluate.execute(run_id, cfg)
        decision = c.register.execute(run_id, thresholds, baseline_quality)
        typer.secho(
            f"[{st.value}] run={run_id} {quality.primary}={quality.primary_value:.4f} -> "
            f"{decision.value}",
            fg="green",
        )
        run_ids[st] = run_id
        if st is Strategy.BASELINE:
            baseline_quality = quality

    if Strategy.BASELINE in run_ids and Strategy.OPTIMIZED in run_ids:
        r = c.compare.execute(run_ids[Strategy.BASELINE], run_ids[Strategy.OPTIMIZED])
        typer.echo(
            f"[compare] ahorro de tiempo: {r.time_saving_ratio:+.1%} | "
            f"delta calidad: {r.quality_delta:+.4f}"
        )


if __name__ == "__main__":
    app()
