# Tune

Laboratorio MLOps para **fine-tuning eficiente** de modelos avanzados de inteligencia artificial.

Tune no depende de un modelo concreto. Recibe un **dataset**, un **modelo preentrenado** y una **estrategia**; ejecuta el pipeline dos veces (baseline caro vs optimizado); registra parámetros, tiempo, memoria y calidad; compara las corridas; y expone el modelo elegido por **API o CLI**.

La pregunta que responde es: *¿podemos adaptar este modelo usando menos recursos sin perder significativamente calidad?*

El caso de estudio (por ejemplo una tarea geoespacial) valida la arquitectura; no la define.

## Documentación

| Documento | Descripción |
|---|---|
| [CaminoInmediato.md](./docs/CaminoInmediato.md) | Orden de avance de la investigación |
| [Investigacion.md](./docs/Investigacion.md) | Pregunta, hipótesis, método y evidencia |
| [architecture/v1.md](./docs/architecture/v1.md) | Arquitectura v1.2 |
| [Desarrollo.md](./docs/Desarrollo.md) | Manual de desarrollo |
| [Instalación.md](./docs/Instalación.md) | Setup local y Docker |
| [plan.md](./docs/plan.md) | Plan de trabajo e hitos |
| [PrimerInforme.md](./docs/PrimerInforme.md) | Informe de planteamiento |
| [SegundoInforme.md](./docs/SegundoInforme.md) | Guía / estado del segundo informe |
| [decisions/001-task-selection.md](./docs/decisions/001-task-selection.md) | ADR: caso de estudio |
| [decisions/002-orchestration.md](./docs/decisions/002-orchestration.md) | ADR: orquestación |
| [decisions/003-protocolo-experimental.md](./docs/decisions/003-protocolo-experimental.md) | ADR: protocolo experimental |

## Inicio rápido

```bash
pip install -e ".[api,dev]"
cp .env.example .env
pytest -q
python scripts/prepare_data.py --name hls_burn_scars --version 1.0 --init-layout
tune prepare -s baseline
tune --help
```

Repositorio: https://github.com/Charlsz/Tune
