---
title: Tune
emoji: 🌊
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 5.49.1
app_file: app.py
pinned: false
license: mit
short_description: Flood analysis with Prithvi-EO 2.0 — free ZeroGPU Space
---

# Tune

Análisis satelital de **inundación** con Prithvi-EO 2.0 (IBM-NASA).

Este Space usa el **plan gratuito**: Gradio + **ZeroGPU** (hasta 2 Spaces en
cuentas personales). La app (SPA + API) está en la raíz; Gradio en `/gradio`.

## Probar

```bash
curl -fsS https://cgalvis21-tune.hf.space/health
python3 scripts/smoke_hf_space.py --base-url https://cgalvis21-tune.hf.space
```
