# ADR 006 — Metadatos del GeoTIFF en el análisis

**Fecha:** 2026-09-28 · **Estado:** Aceptado · **Sigue a:** [ADR 005](./005-app-inferencia-checkpoints-publicados.md)

## Contexto

El análisis guardaba porcentaje, área, CRS y bounds, pero no lo que el GeoTIFF ya trae: fecha de la toma, sensor, resolución, bandas y tags. Sin esa fecha el historial solo podía ordenarse por el momento en que Tune corrió el modelo, que no es la fecha de la escena.

## Decisión

`read_geotiff` arma un `metadata` JSON (driver, tipo, bandas, nodata, compresión, resolución, EPSG, centro, tags recortados). Tras la máscara de píxeles válidos se añaden mínimo, máximo y media de cada banda, y si esa banda entra a Prithvi (`BLUE` … `SWIR_2`).

`acquired_at` (YYYY-MM-DD) se lee en este orden: tags de adquisición (`ACQUISITION_DATE`, `SENSING_TIME`, `DATE_ACQUIRED`, `SENSING_DATE`), nombre del archivo (fecha o día juliano HLS) y, al final, `TIFFTAG_DATETIME`. Ese tag queda último porque a menudo es la fecha de procesado, no la de la toma. Si no hay fecha, el campo queda en null.

`Analysis` y la respuesta de la API llevan `acquired_at` y `metadata` con default, así que un `analysis.json` anterior sigue abriendo. La web los muestra en una ficha plegable y en el historial.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Pedir la fecha al usuario | El TIFF ya la trae, o el nombre oficial de HLS |
| Tratar `TIFFTAG_DATETIME` como la toma | En los ejemplos es la fecha de procesado |

## Consecuencias

- La UI puede decir “fecha desconocida” en escenas como `India_900498_S2Hand.tif`, que no trae fecha en tags ni en el nombre.
- Los análisis viejos no tienen metadatos hasta que se vuelven a correr.
