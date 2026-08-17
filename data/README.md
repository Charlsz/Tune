# Terra datasets

This directory stores local datasets. **Do not commit raw data or model weights to Git.**

## Primary task: Wildfire Scar Detection (Burn Scars)

| Property | Value |
|----------|-------|
| Dataset | [HLS Burn Scars](https://huggingface.co/datasets/ibm-nasa-geospatial/hls_burn_scars) |
| Source | Hugging Face — `ibm-nasa-geospatial` |
| Task | Semantic segmentation of burned areas |
| Model | Prithvi-EO-2.0-300M-TL |

### Download

```bash
# Using Hugging Face CLI (after: pip install huggingface_hub)
huggingface-cli download ibm-nasa-geospatial/hls_burn_scars --repo-type dataset --local-dir data/hls_burn_scars
```

Or follow the dataset preparation steps in the official Colab notebook:

https://colab.research.google.com/github/blumenstiel/TerraTorch-Examples/blob/main/prithvi_v2_eo_300_tl_unet_burnscars.ipynb

### Expected layout

```text
data/hls_burn_scars/
├── data/           # GeoTIFF patches and masks
└── splits/
    ├── train.txt
    ├── val.txt
    └── test.txt
```

## Optional secondary task: Flood Detection

Reserved for extensibility validation (see [Primer Informe](../docs/PrimerInforme.md), sección 7.3).

- Dataset: [Sen1Floods11](https://github.com/cloudtostreet/Sen1Floods11)
- Config reference: `configs/training/` (to be added in a later phase)
