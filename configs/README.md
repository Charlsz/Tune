# configs/

Configuración declarativa. El código no tiene números mágicos: todo lo que cambia
entre corridas vive aquí.

```text
configs/
├── training/
│   ├── baseline.yaml     # referencia (full FT, FP32)
│   └── optimized.yaml    # misma tarea, LoRA + FP16 (u otra técnica)
└── pipeline/
    └── thresholds.yaml   # criterios de promoción / rechazo
```

Reglas:

- `baseline.yaml` y `optimized.yaml` deben diferir **solo** en lo que explica el ahorro
  (sección `training.precision` y `peft`). Dataset, modelo, seed, epochs y test set iguales.
- Cambiar de caso de estudio = cambiar `dataset` y `model` en ambos archivos (ADR 001).
  No tocar `src/tune/domain`.
- Los thresholds son provisionales hasta acordarlos con el tutor (Fase 0.5).
