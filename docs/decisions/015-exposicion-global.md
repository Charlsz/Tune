# ADR 015: Exposición global (cobertura y población)

## Contexto

UN-SPIDER y UNGRD no consumen "porcentaje de píxeles agua". Consumen
hectáreas y gente. WorldCover 2021 y GHSL 2020 cubren el planeta y se
leen por ventana.

## Decisión

Puerto `ExposureProvider`. Si hay `change`, se cruza el agua *nueva*;
si no, la máscara afectada. Salida: km² por clase WorldCover y suma de
población GHSL sobre esos píxeles.

WorldPop mosaico global no admite HTTP Range; GHSL tiles zip sí. Por eso
GHSL y no WorldPop.

## Consecuencias

- `Analysis.exposure` es opcional; JSON viejos cargan con `exposure: null`.
- Flags `TUNE_EXPOSURE` (default true). Caché en `artifacts/exposure/`.
