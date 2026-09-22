# data/

Datasets versionados **fuera de Git** (solo README, `templates/` y `.gitkeep` se commitean).

## Layout

```text
data/
└── <name>/
    └── <version>/
        ├── metadata.yaml
        ├── train/
        ├── val/
        └── test/
```

Plantilla: [`templates/metadata.yaml`](./templates/metadata.yaml).

## Inicializar sin descargar el corpus

```bash
python lab/scripts/prepare_data.py --name hls_burn_scars --version 1.0 --init-layout
tune prepare -s baseline
```

Eso habilita el stage `prepare` del laboratorio. Los tiles/imágenes se poblan en el
entorno de entrenamiento (Kaggle/Colab/lab). Después de poblar, actualizar
`sample_counts` y `checksum` en `metadata.yaml`.

## Fuentes del protocolo (ADR 003)

| name | Origen |
|------|--------|
| `hls_burn_scars` | https://huggingface.co/datasets/ibm-nasa-geospatial/hls_burn_scars |
| `beans` (Plan B) | https://huggingface.co/datasets/beans |

El `root` de `lab/configs/training/*.yaml` es relativo a `TUNE_DATA_DIR` (por defecto `./lab/data`).
