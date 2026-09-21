# Tune

Laboratorio MLOps para **fine-tuning eficiente**: toma un **modelo ya preentrenado**, lo adapta con dos estrategias (baseline vs optimized), registra evidencia y puede servir el resultado.

Pregunta: *¿podemos adaptar este modelo usando menos recursos sin perder significativamente calidad?*

## Empezar (Docker)

### Lab universidad (GPU) — un comando

```bash
cd ~/Desktop/Tune
git pull origin main
make lab-down
make lab-experiment    # Prithvi 2 epochs (perfil viernes)
```

Ver [docs/research/RevisionLab.md](./docs/research/RevisionLab.md).

### Smoke CPU (sin NVIDIA)

```bash
cp .env.example .env
docker compose --profile smoke build training-cpu
docker compose --profile smoke run --rm training-cpu \
  python scripts/prepare_data.py --name cifar10_smoke --version 1.0 --download-cpu-smoke
docker compose --profile smoke run --rm training-cpu tune run -s baseline -s optimized
docker compose --profile smoke down
```

Guía completa: [docs/research/ComoProbar.md](./docs/research/ComoProbar.md)

## Documentación

### Entregables (modelo de repositorio)

| Documento | Descripción |
|---|---|
| [docs/PrimerInforme.md](./docs/PrimerInforme.md) | Informe de planteamiento (**congelado 2026-08-29**) |
| [docs/SegundoInforme.md](./docs/SegundoInforme.md) | Guía / segundo informe |
| [docs/InformeFinal.md](./docs/InformeFinal.md) | Informe final |
| [docs/Instalación.md](./docs/Instalación.md) | Instalación |
| [docs/Desarrollo.md](./docs/Desarrollo.md) | Manual de desarrollo |

### Investigación y arquitectura (carpetas)

| Documento | Descripción |
|---|---|
| [docs/research/ComoProbar.md](./docs/research/ComoProbar.md) | Cómo probar (PC / free-tier / lab) |
| [docs/research/CaminoInmediato.md](./docs/research/CaminoInmediato.md) | Orden de avance |
| [docs/research/Investigacion.md](./docs/research/Investigacion.md) | Marco de investigación |
| [docs/research/plan.md](./docs/research/plan.md) | Plan de trabajo |
| [docs/architecture/v1.md](./docs/architecture/v1.md) | Arquitectura |
| [docs/decisions/](./docs/decisions/) | ADRs |

Repo: https://github.com/Charlsz/Tune
