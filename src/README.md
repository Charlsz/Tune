# src/tune — arquitectura del código

Clean architecture en cuatro capas. Las dependencias solo apuntan hacia adentro:
`interfaces → application → domain ← infrastructure`.

```text
src/tune/
├── domain/                  # SIN frameworks. Entidades, reglas, puertos.
│   ├── entities.py          #   Strategy, TrainingConfig, RunResult, ComparisonResult...
│   ├── policies.py          #   decide_promotion(): la regla de promoción/rechazo
│   └── ports.py             #   Protocols: Trainer, Evaluator, ExperimentTracker, ModelRegistry...
├── application/
│   └── stages/              # Un caso de uso por stage del pipeline (ADR 002)
│       ├── prepare.py  train.py  evaluate.py  register.py  compare.py
├── infrastructure/          # Adaptadores concretos que implementan los puertos
│   ├── config/              #   Settings (env) + YamlConfigRepository
│   ├── data/                #   FilesystemDatasetRepository
│   ├── training/            #   LightningTrainer + instrumentation (tiempo, GPU)
│   ├── evaluation/          #   SegmentationEvaluator (métricas de la tarea)
│   ├── tracking/            #   MlflowTracker
│   ├── registry/            #   MlflowModelRegistry (aliases = stages de promoción)
│   ├── inference/           #   RegistryPredictor
│   └── container.py         #   Composición de dependencias (único lugar que conoce todo)
└── interfaces/
    ├── cli/main.py          # `tune prepare|train|evaluate|register|compare|run`
    └── api/                 # FastAPI: /health, /model, /predict
```

## Reglas

1. `domain/` no importa `torch`, `mlflow`, `fastapi` ni `yaml`. Si lo necesitas, va en
   `infrastructure/` detrás de un puerto.
2. Los stages reciben puertos por constructor. Nunca instancian MLflow ni PyTorch.
3. Dependencias pesadas se importan dentro de funciones/constructores (lazy) para que
   la CLI, la API y los tests corran sin GPU ni torch.
4. Cambiar de caso de estudio (ADR 001) = nuevo `Evaluator` + `DataModule` en
   `infrastructure/` + nuevas configs. `domain/` y `application/` no cambian.
5. Cambiar MLflow por otra herramienta = nuevo adaptador en `tracking/`/`registry/`.

## Dónde va cada cosa nueva

| Quiero…                                  | Va en…                                        |
|------------------------------------------|-----------------------------------------------|
| Una regla de negocio (thresholds, etc.)  | `domain/policies.py`                          |
| Un nuevo stage del pipeline              | `application/stages/` + `container.py` + CLI  |
| Medir algo nuevo de eficiencia           | `infrastructure/training/instrumentation.py`  |
| Métricas de otra tarea                   | `infrastructure/evaluation/<tarea>.py`        |
| Un endpoint                              | `interfaces/api/main.py` + `schemas.py`       |
