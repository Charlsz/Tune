# ADR 016: Validación multi-sitio, no un territorio exclusivo

## Contexto

Un piloto único (La Mojana) convertiría Tune en una app de un humedal.
Copernicus GFM, OPERA y Flood Hub cubren el planeta. El catálogo STAC y
JRC ya son globales.

## Decisión

El protocolo de validación es una lista de sitios y controles
(`docs/validation/sitios.yaml`). Incluye escenas oficiales Sen1Floods11
y al menos un evento documentado. Magdalena es un renglón opcional, no
el alcance. `make validate-sites` escribe pasó / no pasó.

## Consecuencias

- El producto se defiende en cualquier lat/lon.
- La Mojana no aparece como marca del sistema.
- Los umbrales (río en seca < 0.15, cauce visible en `spain`) viven en
  el YAML y en los objetivos del segundo informe.
