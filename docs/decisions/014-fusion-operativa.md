# ADR 014: Fusión con productos operativos globales

## Contexto

Prithvi (óptico) produce W_t en cualquier lat/lon con Sentinel-2. Copernicus
GFM y NASA OPERA DSWx ya publican agua/inundación a escala global. El
profesor ve una app simple si Tune solo pinta su propia máscara.

## Decisión

Puerto `ObservationProvider`. Presets STAC: GFM (público, EODC) y OPERA
DSWx-S1 / HLS (Earthdata, token opcional). Tune alinea la capa a la grilla
del análisis, calcula IoU y tres residuales (acuerdo, solo Tune, solo
externo) y escribe `fusion.png`. Un fallo del proveedor no tumba el análisis.

OPERA queda apagado por defecto (`TUNE_OBSERVE_OPERA=false`) porque los
assets están detrás de Earthdata. GFM está encendido (`TUNE_OBSERVE_GFM=true`).

## Consecuencias

- La app sigue siendo global: el usuario elige cualquier coordenada.
- La cifra defendible junto a `new_km2` es el IoU cuando hay capa externa.
- Tests sin red: monkeypatch de `_search` y `_read_window`.
