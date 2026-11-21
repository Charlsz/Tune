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

| Rol | Fecha | Escena STAC | Análisis | Agua (km²) | Nueva | Permanente | Referencia |
|---|---|---|---|---:|---:|---:|---|
| Línea base | 2022-05-18 | `S2B_42RVR_20220518_0_L2A` | `f8dc0d546727` | 10.3436 | 7.0620 | 3.2704 | `jrc_gsw_v1_4` |
| Pico | 2022-09-05 | `S2B_42RVR_20220905_0_L2A` | `8cf25b2454e0` | 60.2228 | **49.5556** | **10.0304** | `history_baseline` ← mayo |

Centro: `lat=27.70`, `lon=68.85`.

En el pico, el mapa de cambio debe verse con **azul** (cauce que ya estaba en
mayo) y **rojo** (lámina nueva de la crecida). Si solo ves rojo sobre el mismo
río, estás mirando la corrida en frío (solo JRC), no la que usa historial.

### 2. Bajo Magdalena (Colombia) — seca → húmeda 2022

| Rol | Fecha | Escena STAC | Análisis | Agua (km²) | Nueva | Permanente | Referencia |
|---|---|---|---|---:|---:|---:|---|
| Seca | 2022-02-22 | `S2B_18PWQ_20220222_0_L2A` | `4112dd743eb5` | 21.9460 | 21.1756 | 0.7704 | `jrc_gsw_v1_4` |
| Húmeda | 2022-05-08 | `S2A_18PWQ_20220508_0_L2A` | `f43f387ee456` | 55.0804 | **38.2524** | **16.1740** | `history_baseline` ← febrero |

Centro: `lat=8.85`, `lon=-74.65`.

Orden obligatorio: analizar primero la fecha **anterior**, luego la posterior.
El historial solo acepta escenas con `acquired_at` estrictamente menor.

### 3. Mississippi (EE. UU.) — 2018 → crecida 2019

| Rol | Fecha | Escena STAC | Análisis | Agua (km²) | Nueva | Permanente | Referencia |
|---|---|---|---|---:|---:|---:|---|
| Base | 2018-09-18 | `S2B_16SBF_20180918_0_L2A` | `9f848a436212` | 72.1604 | 51.3188 | 20.8284 | `jrc_gsw_v1_4` |
| Pico | 2019-06-10 | `S2A_16SBF_20190610_0_L2A` | `63e4ca323471` | 76.1192 | **10.2628** | **65.8452** | `history_baseline` |

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

En MapApp (`http://localhost:8080`): mismo centro, fechas Antes/Después del
par, **Analizar**, modo **Cambio**. La cifra grande / métrica **Nueva** es agua
nueva, no toda el agua del modelo. Si EODC devolvió GFM, aparece IoU y el modo
**Acuerdo**; si no, el botón queda desactivado (el análisis igual es válido).

## Qué cambió en el código (nov 2026)

1. El historial puede usar **una** fecha previa como `history_baseline`.
2. Solo cuentan fechas **anteriores** a la escena actual (`as_of`).
3. El historial se prueba **antes** que JRC, para que un JRC pobre en humedales
   no tape la línea base del territorio.
