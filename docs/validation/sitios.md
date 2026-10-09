# Validación multi-sitio (cualquier coordenada)

**Fecha del protocolo:** 2026-10-06 · **Config:** [sitios.yaml](./sitios.yaml)
**Script:** `python scripts/validate_sites.py` o `make validate-sites`

Tune no está anclado a un territorio. El catálogo STAC y JRC cubren cualquier
punto con Sentinel-2 y agua permanente. Este protocolo fija *controles de
coherencia* sobre unos cuantos sitios para que los números se puedan repetir;
la app acepta lat/lon en cualquier continente.

## Controles

| Control | Criterio | Sitio |
|---|---|---|
| Río (seca) | `new_km2 / affected_km2 < 0.15` | magdalena (fecha seca) |
| Cauce visible | `persistent_km2 > 0` y `new_km2 < affected_km2` | spain |
| Evento | `new_km2` claramente > 0 | pakistan 2022 o magdalena pico |
| Acuerdo externo | IoU Tune vs GFM cuando GFM responde | el primero que tenga fusión |

## Reproducción

```bash
# API en :8000 con pesos cacheados
make validate-sites
# o
python scripts/validate_sites.py --api http://localhost:8000
```

El script escribe `docs/validation/sitios-resultados.json`. Si la API no
responde, falla con mensaje claro. Los controles quedan como pasó / no pasó.
