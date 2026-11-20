# Resultados de validación — Sindh (Pakistán) 2022

AOI: lat 27.70, lon 68.85, side_km 12 · task=flood · max_cloud=40  
Modelo: `ibm-nasa-geospatial/Prithvi-EO-2.0-300M-TL-Sen1Floods11`

| Fase | Catalog ID | Análisis | Detectado (km²) | Nueva (km²) | Persistente (km²) | Recedida (km²) | Población expuesta | Referencia cambio |
|------|------------|----------|-----------------|-------------|-------------------|----------------|--------------------|-------------------|
| Pre (2022-05-18) | `S2B_42RVR_20220518_0_L2A` | `a4c7b4c0480f` | 10.34 | 7.06 | 3.27 | 0.62 | 0.0 | JRC GSW v1.4 |
| Peak (2022-09-05) | `S2B_42RVR_20220905_0_L2A` | `dd5b7490e5b2` | 60.22 | 49.56 | 10.03 | 0.29 | 0.0 | history_baseline → pre |

**Δ agua detectada:** 10.34 → 60.22 km² (+49.88 km²). En el pico, nueva (49.56) ≫ persistente (10.03).

Artefactos API (prefijo `http://127.0.0.1:8000`):

- Pre preview/mask/change: `/api/analyses/a4c7b4c0480f/{preview_png,mask_png,change_png}`
- Peak preview/mask/change: `/api/analyses/dd5b7490e5b2/{preview_png,mask_png,change_png}`

JSON completo: `docs/validation/sitios-resultados-pakistan.json`

## Evidencia visual

| Archivo | Contenido |
|---------|-----------|
| `docs/assets/proof/pakistan-pre-mask.png` | Máscara pre (poca agua) |
| `docs/assets/proof/pakistan-peak-mask.png` | Máscara peak (inundación amplia) |
| `docs/assets/proof/pakistan-peak-change.png` | Cambio peak vs history_baseline |
| `docs/assets/proof/pakistan-pre-preview.png` / `pakistan-peak-preview.png` | Previews RGB |
| `docs/assets/proof/pakistan-ui-aoi-map.png` | UI mapa AOI Sindh (sin overlay; historial local vacío) |

**Nota UI:** Los análisis vía API quedan en el servidor (`GET /api/analyses` lista ambos), pero el historial del front es local — Resultados/Historial aparecen vacíos hasta analizar desde la UI.
