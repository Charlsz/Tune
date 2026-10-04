# ADR 011: Catálogo STAC Sentinel-2 L2A

## Contexto

El usuario debe poder analizar una zona por coordenada y fecha sin conseguir
un GeoTIFF a mano. Earth Search v1 de Element84 publica COGs L2A públicos
en AWS sin cuenta.

## Decisión

- Puerto `SceneCatalog` con `search` y `fetch_six_bands`.
- Implementación `StacCatalog` contra `https://earth-search.aws.element84.com/v1`,
  colección `sentinel-2-l2a`.
- Bandas B02, B03, B04, B8A, B11, B12 remuestreadas a 20 m (menos memoria;
  el modelo no es sensible a 10 m).
- SCL clases 3, 8, 9, 10, 11 → nodata. Si la fracción nublada del bbox supera
  40 %, se rechaza con 422.
- Desde el baseline 04.00 (2022-01-25) se aplica `BOA_ADD_OFFSET = -1000`.
- Área máxima configurable (`TUNE_CATALOG_MAX_KM`, default 30 km por lado).

## Advertencias

1. El checkpoint Sen1Floods11 se entrenó con L1C (TOA). L2A es BOA: hay un
   sesgo sistemático que se valida en el piloto, no se asume nulo.
2. La lectura usa `/vsicurl/` por ventana; nunca se descarga el tile completo.

## Consecuencias

- Extra `api` incluye `pystac-client`.
- Endpoints `GET /api/catalog/search` y `POST /api/catalog/{item_id}/analyze`.
- Tests sin red: monkeypatch de `_client` y `_read_window`.
