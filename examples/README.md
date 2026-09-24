# Ejemplos de entrada

Tune espera un **GeoTIFF** con las 6 bandas Prithvi (BLUE, GREEN, RED, NIR_NARROW, SWIR_1, SWIR_2) o, en inundación, un Sentinel-2 L1C completo.

Los `.tif` no van en Git. Hay seis escenas oficiales en los repos de IBM-NASA (tres de inundación, tres de cicatriz), unos 22 MB en total.

Desde la web: elige la tarea y pulsa una escena de la lista. La API la baja una vez (queda en `artifacts/examples/`) y la analiza.

Desde el disco:

```bash
make examples
tune analyze --task flood --input examples/India_900498_S2Hand.tif
```

- Inundación: [Sen1Floods11 examples](https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M-TL-Sen1Floods11/tree/main/examples)
- Cicatriz: [Burn Scars examples](https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M-BurnScars/tree/main/examples)
