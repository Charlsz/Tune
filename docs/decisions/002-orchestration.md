# ADR 002: Orquestación del pipeline MLOps

**Estado:** Aceptado  
**Fecha:** 2026-08-17  
**Contexto:** [Primer Informe](../PrimerInforme.md) — sección 5 (diagrama de arquitectura)

## Contexto

El primer informe incluye un componente **Orchestrator** en el diagrama de arquitectura. Para un prototipo académico de grado, se debe elegir un mecanismo de orquestación proporcional al alcance del proyecto, evitando infraestructura innecesaria (Kubernetes, Airflow, Prefect) salvo que aporte valor demostrable.

## Opciones consideradas

| Opción | Pros | Contras |
|--------|------|---------|
| Script Python + CLI (`scripts/run_pipeline.py`) | Simple, reproducible, fácil de documentar | Sin UI de orquestación |
| Makefile | Comandos claros por stage | Menos flexible para lógica condicional |
| Prefect / Airflow | Orquestación enterprise | Complejidad alta para 2 personas / 12 semanas |
| Kubernetes / Argo | Escalable en producción | Fuera del alcance académico declarado |

## Decisión

Utilizar un **pipeline script en Python** con stages explícitos:

```text
prepare → train → evaluate → register
```

Invocable desde la línea de comandos. Las configuraciones se externalizan en YAML (`configs/`). MLflow registra metadatos de cada ejecución.

## Justificación

1. Cumple el objetivo específico 5 del primer informe: *automatizar la evaluación y establecer criterios de promoción*.
2. Es reproducible: mismo script + misma config = mismo flujo.
3. No contradice el diagrama del informe: el orchestrator es lógico; la implementación es un script, no un cluster.
4. Permite evolucionar a Prefect/Airflow en el futuro sin rediseñar los stages.

## Consecuencias

- El pipeline vive en `scripts/run_pipeline.py` (implementación pendiente — Fase 3).
- Cada stage es una función o subcomando independiente y testeable.
- La documentación de arquitectura reflejará esta decisión.

## Referencias

- [Primer Informe — Restricciones](../PrimerInforme.md#23-restricciones-y-supuestos-iniciales)
- [Plan de trabajo — Fase 3](../plan.md#fase-3--pipeline-automatizado-semana-6)
