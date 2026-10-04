# Piloto La Mojana: detección de cambio hídrico

**Fecha del protocolo:** 2026-10-04 · **Sitio:** La Mojana (Sucre, Bolívar, Córdoba)
**Config:** [piloto.yaml](./piloto.yaml) · **Script:** `python scripts/piloto.py` o `make piloto`

## Objetivo

Un solo territorio, con números verificables, donde inundación significa
agua nueva frente a una referencia (JRC o historial), no "todo el agua".

## Bbox

Centro aproximado `(8.85, -74.65)`, lado 25 km. Ver `piloto.yaml`.

## Protocolo

1. Levantar la API con pesos cacheados (`make app-up` o uvicorn local con `[training]`).
2. Ejecutar `make piloto` (busca escenas Sentinel-2 L2A y analiza las que cumplan
   nubosidad; escribe `docs/validation/piloto-resultados.json`).
3. Completar la tabla de controles abajo con los números del JSON.
4. Repetir el control de río con la escena oficial `spain` (cauce visible).

## Controles de coherencia

| Control | Criterio | Valor | Pasó |
|---|---|---|---|
| Río (seca) | `new_km2 / affected_km2 < 0.15` | Pendiente de corrida | — |
| Estabilidad de referencia | IoU persistente entre dos secas > 0.7 | Pendiente | — |
| Sensibilidad al evento | `new_km2` pico ≥ 3× seca | Pendiente | — |
| Comparación externa | Copernicus EMS / UNGRD si existe | Declarar si no hay producto | — |
| Sectores | Top 5 en pico coinciden con corregimientos conocidos | Pendiente | — |
| Río fuera de Colombia (`spain`) | `persistent > 0` y `new < affected` | Pendiente (ver también jrc.md) | — |

## Tabla por fecha (rellenar tras `make piloto`)

| Fecha | affected_km2 | new_km2 | persistent_km2 | receded_km2 | referencia | latencia_s |
|---|---|---|---|---|---|---|
| (seca 1) | | | | | | |
| (seca 2) | | | | | | |
| (pico 1) | | | | | | |
| (pico 2) | | | | | | |
| (media 1) | | | | | | |
| (media 2) | | | | | | |

## Limitaciones (observadas)

Registrar aquí, con números, no con adjetivos:

- Nubes residuales en SCL (fracción del recorte).
- Sesgo L2A (BOA) vs L1C (TOA) del checkpoint Sen1Floods11.
- Bordes de tile JRC / desalineación de 30 m.
- Residuo de "agua nueva" en seca (bancos de arena, bordes de río).

## Reproducción

```bash
# API en :8000 con TUNE_REFERENCE_JRC=true
make piloto
# o
python scripts/piloto.py --api http://localhost:8000
```

El script no inventa números: si la API no responde o no hay escenas, falla
con mensaje claro y deja la tabla en "Pendiente".
