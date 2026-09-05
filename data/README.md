# data/

Datasets versionados **fuera de Git** (solo este README y `.gitkeep` se commitean).

Layout esperado por `FilesystemDatasetRepository`:

```text
data/
└── <name>/
    └── <version>/
        ├── metadata.yaml   # fuente (URL), fecha de descarga, licencia, checksum, nº de muestras por split
        ├── train/
        ├── val/
        └── test/
```

Cómo obtenerlo: `python scripts/prepare_data.py --name <name> --version <version>`.

El `root` que declaran `configs/training/*.yaml` es relativo a esta carpeta
(`TUNE_DATA_DIR`). En Docker se monta como volumen en `/app/data`.
