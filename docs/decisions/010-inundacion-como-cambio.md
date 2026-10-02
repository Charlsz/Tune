# ADR 010 — Inundación como agua nueva frente a una referencia

**Fecha:** 2026-10-02 · **Estado:** Aceptado · **Sigue a:** [ADR 009](./009-riesgo-futuro.md)

## Contexto

El checkpoint Sen1Floods11 clasifica agua, no inundación. Una escena del Magdalena en época seca salía como "área inundada" porque el río es agua. El profesor y el equipo coincidieron: sin imagen de referencia no se puede saber si el agua es desborde.

## Decisión

Definición operativa: inundación \(F_t = W_t \land \lnot P\), donde \(W_t\) es el agua detectada por Prithvi en la fecha \(t\) y \(P\) es el agua permanente de referencia. Para cicatriz de incendio: cicatriz nueva \(= B_t \land \lnot B_{ref}\).

Cada análisis puede llevar un `ChangeSummary` (píxeles y km² nuevos, persistentes y retirados) y artefactos `change.png` / `reference.tif`. La fuente de \(P\) se elige en este orden:

1. JRC Global Surface Water (occurrence ≥ 75 %), cuando esté cableado.
2. Historial del mismo territorio (ocurrencia ≥ 75 % en al menos 2 fechas previas).
3. Sin referencia: el análisis se guarda igual, sin `change`.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Seguir reportando "agua" como "inundación" | Falso positivo sistemático en cauces |
| Exigir que el usuario suba la referencia | Rompe la demo; JRC cubre el primer caso |
| Entrenar un detector de inundación propio | Fuera del plazo |

## Consecuencias

- La API expone `change` en `AnalysisResponse`. Los `analysis.json` viejos cargan con `change: null`.
- Hacen falta al menos dos fechas previas del territorio para la referencia por historial (o JRC en la primera).
- El porcentaje "afectado" del modelo sigue siendo agua detectada; la cifra que se defiende como inundación es `new_area_km2`.
