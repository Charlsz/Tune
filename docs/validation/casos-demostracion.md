# Casos de demostración: inundación = agua nueva

**Fecha:** 2026-11-05 · **Definición:** [ADR 010](../decisions/010-inundacion-como-cambio.md)

El checkpoint Prithvi detecta **agua**, no inundación. La cifra que se defiende
como inundación es `change.new_area_km2` = agua detectada **menos** la
referencia (JRC en frío, o **línea base** del historial del mismo territorio).

Los ejemplos oficiales de Sen1Floods11 (India / España) sirven para ver la
máscara de agua, **no** para demostrar inundación: JRC casi no marca permanente
en esos tiles y no hay un “antes” en el historial.

## Pares que sí muestran la diferencia

Reproducibles con la API levantada (`make app-up` o uvicorn local). Recorte
`side_km=12`, `max_cloud≈45`.

### 1. Pakistán Sindh — inundación 2022

| Rol | Fecha | Escena STAC | Agua (km²) | Nueva | Permanente | Referencia |
|---|---|---|---|---|---|---|
| Línea base | 2022-05-18 | `S2B_42RVR_20220518_0_L2A` | ~10,3 | (frío: JRC) | ~3,3 vs JRC | `jrc_gsw_v1_4` |
| Pico | 2022-09-05 | `S2B_42RVR_20220905_0_L2A` | ~60,1 | **~49,5** | **~10,0** | `history_baseline` ← mayo |

Centro: `lat=27.70`, `lon=68.85`.

En el pico, el mapa de cambio debe verse con **azul** (cauce que ya estaba en
mayo) y **rojo** (lámina nueva de la crecida). Si solo ves rojo sobre el mismo
río, estás mirando la corrida en frío (solo JRC), no la que usa historial.

### 2. Bajo Magdalena (Colombia) — seca → húmeda 2022

| Rol | Fecha | Escena STAC | Agua (km²) | Nueva | Permanente | Referencia |
|---|---|---|---|---|---|---|
| Seca | 2022-02-22 | `S2B_18PWQ_20220222_0_L2A` | ~22,0 | (frío: JRC débil en humedal) | ~0,8 vs JRC | `jrc_gsw_v1_4` |
| Húmeda | 2022-05-08 | `S2A_18PWQ_20220508_0_L2A` | ~55,1 | **~38,2** | **~16,2** | `history_baseline` ← febrero |

Centro: `lat=8.85`, `lon=-74.65`.

Orden obligatorio: analizar primero la fecha **anterior**, luego la posterior.
El historial solo acepta escenas con `acquired_at` estrictamente menor.

### 3. Mississippi (EE. UU.) — 2018 → crecida 2019

| Rol | Fecha | Escena STAC | Agua (km²) | Nueva | Permanente | Referencia |
|---|---|---|---|---|---|---|
| Base | 2018-09-18 | `S2B_16SBF_20180918_0_L2A` | ~72,1 | (JRC) | ~20,8 vs JRC | `jrc_gsw_v1_4` |
| Pico | 2019-06-10 | `S2A_16SBF_20190610_0_L2A` | ~76,2 | **~10,3** | **~65,9** | `history_baseline` |

Centro: `lat=37.00`, `lon=-89.18`. Aquí hay mucha agua permanente; el pico añade una
lámina nueva medible sin “pintar de rojo” todo el río.

Capturas en [`docs/assets/proof/`](../assets/proof/).

## Cómo reproducir

```bash
# API en :8000 con pesos cacheados
# 1) línea base
curl -X POST "http://localhost:8000/api/catalog/S2B_42RVR_20220518_0_L2A/analyze" \
  -F task=flood -F lat=27.70 -F lon=68.85 -F side_km=12 -F max_cloud=40
# 2) pico (usa la máscara de mayo como permanente)
curl -X POST "http://localhost:8000/api/catalog/S2B_42RVR_20220905_0_L2A/analyze" \
  -F task=flood -F lat=27.70 -F lon=68.85 -F side_km=12 -F max_cloud=40
```

En la web: Historial → abrir el pico → capa **Posible inundación**.
La cifra grande del resumen es agua nueva, no toda el agua del modelo.

## Qué cambió en el código (nov 2026)

1. El historial puede usar **una** fecha previa como `history_baseline`.
2. Solo cuentan fechas **anteriores** a la escena actual (`as_of`).
3. El historial se prueba **antes** que JRC, para que un JRC pobre en humedales
   no tape la línea base del territorio.
