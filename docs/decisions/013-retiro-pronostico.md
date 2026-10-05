# ADR 013: Retiro del pronóstico de la demo

## Contexto

ADR 009 añadió `GET /api/forecast` (GloFAS / Hot-Dry-Windy vía Open-Meteo)
como tarjeta de "riesgo futuro". El profesor excluyó el pronóstico del alcance
defendible: no usa el modelo Prithvi y desplaza la atención del problema real
(agua vs inundación).

## Decisión

Eliminar el endpoint, los schemas `Forecast*`, `infrastructure/forecast.py`,
`RiskCard.tsx`, los tipos `Forecast*` y sus tests. ADR 009 queda marcado como
reemplazado por ADR 010 (definición de inundación como cambio) y por este ADR.

## Consecuencias

- La demo se centra en máscara, cambio frente a referencia, serie y sectores.
- Open-Meteo deja de ser dependencia de la app.
- Análisis antiguos no se tocan; el pronóstico nunca se persistía.
