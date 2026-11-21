# Resultados de validación multi-sitio

Corrida 2026-11-20 con `scripts/validate_sites.py` contra `http://127.0.0.1:8000`.
Ocho análisis, todos HTTP 201. Estos sitios son controles de calidad, no el
alcance geográfico del producto.

Leyenda de la tabla generada: **S1** = agua detectada (km²), **S2** = agua nueva (km²), **ratio** = S2/S1, **IoU** = acuerdo con GFM (nulo si no hubo píxeles comparables), **pop** = población GHSL, **s** = latencia.

JSON: [sitios-resultados.json](./sitios-resultados.json). Lectura para el informe: [InformeFinal.md](../InformeFinal.md) §13.4.

| Sitio | Grupo | S1 km² | S2 km² | ratio | IoU | pop | s |
|---|---|---|---|---|---|---|---|
| spain | example | 5.615 | 0.000 | 0.000 | — | 0.000 | 189.354 |
| india | example | 10.993 | 10.833 | 0.985 | — | 0.000 | 33.653 |
| magdalena | dry | 21.946 | 21.176 | 0.965 | — | 0.000 | 124.789 |
| magdalena | peak | 55.080 | 38.252 | 0.694 | — | 0.000 | 193.970 |
| pakistan | pre | 10.344 | 7.062 | 0.683 | — | 0.000 | 179.469 |
| pakistan | peak | 60.223 | 49.556 | 0.823 | 0.204 | 0.000 | 196.942 |
| mississippi | pre | 72.160 | 51.319 | 0.711 | 0.000 | 0.000 | 238.453 |
| mississippi | peak | 76.119 | 10.263 | 0.135 | 0.316 | 0.000 | 260.354 |

## Controles

- **spain_river**: pasó — `{"persistent_km2": 5.6154087868068014, "new_km2": 0, "affected_km2": 5.6154087868068014, "passed": true}`
- **river_dry**: no pasó — `{"ratios": [0.9648956529663719], "max_allowed": 0.15, "passed": false, "note": "En humedales JRC suele fallar este control; el pico con baseline sí vale."}`
- **magdalena_peak_change**: pasó — `{"runs": [{"new_km2": 38.2524, "persistent_km2": 16.174, "reference_source": "history_baseline"}], "passed": true}`
- **pakistan_peak_change**: pasó — `{"runs": [{"new_km2": 49.5556, "persistent_km2": 10.0304, "reference_source": "history_baseline"}], "passed": true}`

