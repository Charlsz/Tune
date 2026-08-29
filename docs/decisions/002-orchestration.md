# ADR 002: Orquestación del pipeline MLOps

**Estado:** Actualizado (Tune)  
**Fecha original:** 2026-08-17  
**Actualizado:** 2026-08-29  
**Contexto:** [Primer Informe](../PrimerInforme.md) — sección 5

## Contexto

El primer informe incluye un **Orchestrator / Pipeline** en la arquitectura de Tune. Para un prototipo académico se elige un mecanismo proporcional al alcance, evitando Kubernetes, Airflow o Prefect salvo que aporten valor demostrable.

El pipeline debe poder ejecutar **dos estrategias** (baseline y optimized) y **compararlas**, no solo entrenar una vez.

## Opciones consideradas

| Opción | Pros | Contras |
|--------|------|---------|
| Script Python + CLI (`scripts/run_pipeline.py`) | Simple, reproducible, fácil de documentar | Sin UI de orquestación |
| Makefile | Comandos claros por stage | Menos flexible para lógica condicional |
| Prefect / Airflow | Orquestación enterprise | Complejidad alta para un prototipo de grado |
| Kubernetes / Argo | Escalable en producción | Fuera del alcance académico declarado |

## Decisión

Utilizar un **pipeline script en Python** con stages explícitos:

```text
prepare → train → evaluate → register → compare
```

`train` recibe la estrategia (`baseline` | `optimized`). `compare` confronta dos runs ya registrados. Invocable desde la línea de comandos. Configuraciones en YAML (`configs/`). MLflow registra metadatos de cada ejecución.

## Justificación

1. Cumple los objetivos específicos 2, 5 y 8 del primer informe: flujo reproducible, par experimental y validación del pipeline.
2. Es reproducible: mismo script + misma config = mismo flujo.
3. No contradice el diagrama: el orchestrator es lógico; la implementación es un script, no un cluster.
4. Permite evolucionar a Prefect/Airflow más adelante sin rediseñar los stages.

## Consecuencias

- El pipeline vive en `scripts/run_pipeline.py` (implementación en la fase de automatización).
- Cada stage es una función o subcomando independiente y testeable.
- La arquitectura v1 refleja esta decisión.

## Referencias

- [Primer Informe — Restricciones](../PrimerInforme.md#23-restricciones-y-supuestos-iniciales)
- [Plan de trabajo — Fase 4](../plan.md#fase-4--evaluación-promoción-y-pipeline)
