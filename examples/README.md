# Ejemplos de entrada

Tune espera un **GeoTIFF** con las 6 bandas Prithvi (BLUE, GREEN, RED, NIR_NARROW, SWIR_1, SWIR_2) o, en inundación, un Sentinel‑2 L1C completo.

Los `.tif` no van en Git. Usa las escenas de ejemplo de cada modelo:

- Inundación: [Sen1Floods11 examples](https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M-TL-Sen1Floods11/tree/main/examples)
- Cicatriz: [Burn Scars examples](https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M-BurnScars/tree/main/examples)

```bash
tune analyze --task flood --input escena.tif
```
