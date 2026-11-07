---
title: Tune
emoji: 🌊
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Flood analysis with Prithvi-EO 2.0 (IBM-NASA) — free CPU Space
---

# Tune

Aplicación de análisis satelital de **inundación** con Prithvi-EO 2.0 (IBM-NASA).

Este Space usa el **plan gratuito** (`cpu-basic`: 2 vCPU / 16 GB). Duerme tras un rato
sin tráfico; el primer request tras despertar puede tardar unos segundos.

## Qué incluye

- Frontend + API en el mismo origen (`/`, `/api`, `/health`)
- Análisis sembrados (Magdalena, Sindh, Mississippi, …) listos para explorar
- Inferencia CPU del checkpoint Sen1Floods11 (descargado en el build)

## Probar

```bash
curl -fsS https://<user>-tune.hf.space/health
curl -fsS https://<user>-tune.hf.space/api/tasks
curl -fsS https://<user>-tune.hf.space/api/analyses | head
```

O desde el repo:

```bash
python scripts/smoke_hf_space.py --base-url https://<user>-tune.hf.space
```
