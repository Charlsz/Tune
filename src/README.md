# src/tune — código del producto

Clean architecture. Dependencias hacia adentro: `interfaces → application → domain ← infrastructure`.

## Núcleo (app)

```text
src/tune/
├── domain/analysis.py           # HazardTask, Analysis, GeoBounds
├── application/analyze.py       # AnalyzeUseCase + compute_stats
├── infrastructure/
│   ├── inference/prithvi.py     # checkpoints IBM-NASA, ventana 512×512
│   └── analyses/filesystem.py   # artifacts/analyses/<id>/
└── interfaces/
    ├── api/analyses.py          # /api/analyze, historial
    └── cli/main.py              # tune analyze
```

## Laboratorio (secundario)

`application/stages/`, `infrastructure/training|tracking|registry|evaluation`, entidades de corridas en `domain/entities.py`. Configs y scripts están en [`lab/`](../lab/README.md), no aquí.

## Reglas

1. `domain/` no importa `torch`, `mlflow`, `fastapi`, `rasterio` ni `yaml`.
2. Los casos de uso reciben puertos por constructor.
3. Imports pesados (TerraTorch) son perezosos.
4. Cambiar de checkpoint = `MODEL_CARDS` en `prithvi.py`; el dominio no cambia.

| Quiero… | Va en… |
|---------|--------|
| Estadística de la máscara | `application/analyze.py` |
| Bandas / sliding window | `infrastructure/inference/prithvi.py` |
| Endpoint | `interfaces/api/analyses.py` |
| Stage de fine-tuning | `application/stages/` + `lab/configs/` |
