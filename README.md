# Tune

Laboratorio MLOps (prototipo académico) para **fine-tuning eficiente** de modelos avanzados de inteligencia artificial.

Tune no depende de un modelo concreto. Recibe un **dataset**, un **modelo preentrenado** y una **estrategia**; ejecuta el pipeline dos veces (baseline caro vs optimizado); registra parámetros, tiempo, memoria y calidad; compara las corridas; y expone el modelo elegido por **API o CLI**.

La pregunta que responde es: *¿podemos adaptar este modelo usando menos recursos sin perder significativamente calidad?*

El caso de estudio (por ejemplo una tarea geoespacial) valida la arquitectura; no la define.

## Documentación del repositorio

### Primer informe

- [PrimerInforme.md](./docs/PrimerInforme.md): Documento que presenta el planteamiento del problema, los objetivos, la solución propuesta, el estado del arte, la metodología de desarrollo y el plan de trabajo del proyecto.

### Segundo informe

- [SegundoInforme.md](./docs/SegundoInforme.md): Documento que presenta el estado actual del proyecto, incluyendo los avances logrados, las validaciones realizadas y los aspectos pendientes.

### Informe final

| Documento | Descripción |
|---|---|
| [InformeFinal.md](./docs/InformeFinal.md) | Documento principal de cierre |
| [Instalación.md](./docs/Instalación.md) | Guía de instalación, desarrollo y despliegue |
| [Desarrollo.md](./docs/Desarrollo.md) | Detalles técnicos del desarrollo |

### Arquitectura, investigación y plan

| Documento | Descripción |
|---|---|
| [CaminoInmediato.md](./docs/CaminoInmediato.md) | Por dónde ir ahora (reunión tutor + siguientes pasos) |
| [Investigacion.md](./docs/Investigacion.md) | Investigación: pregunta, hipótesis, estado del arte aplicado |
| [architecture/v1.md](./docs/architecture/v1.md) | Arquitectura Tune v1.2 (código + estado real) |
| [Desarrollo.md](./docs/Desarrollo.md) | Manual de desarrollo y extensión |
| [Instalación.md](./docs/Instalación.md) | Setup local y Docker |
| [plan.md](./docs/plan.md) | Plan de trabajo e hitos |
| [decisions/001-task-selection.md](./docs/decisions/001-task-selection.md) | ADR: caso de estudio |
| [decisions/002-orchestration.md](./docs/decisions/002-orchestration.md) | ADR: orquestación del pipeline |
| [decisions/003-propuesta-fase0-tutor.md](./docs/decisions/003-propuesta-fase0-tutor.md) | Guion / propuesta reunión tutor |

## Estudiantes

| Nombre | GitHub |
|---|---|
| Carlos Andrés Galvis Pájaro | [@Charlsz](https://github.com/Charlsz) |
| Zenen Contreras Royero | [@zenencontreras](https://github.com/zenencontreras) |

## Tutores

- Daniel Romero
