# Camino de investigación — Tune

**Propósito:** orden de trabajo para no estancarse. Una evidencia por iteración.

**Invariante:** `docs/PrimerInforme.md` quedó congelado en la entrega del **2026-08-29** (`3c13bc8`). No modificarlo; el protocolo vivo va en ADR 003 / Investigación / este camino.

---

## Flujo ramas vs lab U

| Lugar | Regla |
|-------|--------|
| Desarrollo | Ramas `feat/*` → PR → `main` |
| Universidad (AnyDesk) | Solo `main` + `git pull` + `make lab-up` / `make lab-down` |

Casos: **modelo 1** Prithvi + Burn Scars primero; **modelo 2** por escoger (mismo pipeline).

## Dónde estamos

| Capa | Estado | Demostrable ya |
|------|--------|----------------|
| Pregunta + arquitectura | Definidas | Sí |
| CLI / API / Docker / CI | OK; `make lab-up` para lab GPU | Sí |
| Smoke clasificación CPU | ResNet18 preentrenado | Sí |
| Layout de datos + metadata | Inicializable con script | Sí (`--init-layout`) |
| Train segmentación Prithvi / predict | Pendiente de PR a `main` | No fingir end-to-end EO aún |

---

## Decisiones ya tomadas (no esperar)

Ver [003-protocolo-experimental.md](../decisions/003-protocolo-experimental.md):

- Caso A → pivot floods → Plan B  
- Baseline FP32 full FT vs LoRA+FP16  
- mIoU + umbrales 0.60 / 0.02  
- Free-tier (Kaggle/Colab) válido como hardware de corrida si se documenta y se usa el **mismo** para ambas estrategias  

---

## Orden de avance

```text
1. init layout + metadata  →  tune prepare
2. smoke Burn Scars (1 epoch / subset) en GPU free-tier
3. trainer + ResourceProbe  →  tune train (baseline)
4. evaluator  →  tune evaluate
5. completar get_run / registry  →  register + compare
6. optimized + tabla eficiencia/calidad
7. /predict + demo mínima
8. redacción de resultados (Investigacion + informes)
```

### Dueños por carpeta (sin personas)

| Área | Carpetas |
|------|----------|
| MLOps / infra | `tracking/`, `registry/`, `interfaces/`, `docker/`, CI |
| ML / datos | `training/`, `evaluation/`, `data/`, `scripts/prepare_data.py`, `notebooks/` |
| Compartido | `domain/`, `container.py`, thresholds, ADRs — PRs cortos |

Ramas: `feat/…` desde `main`; no editar la misma ruta en paralelo.

---

## Prueba de vida (sin GPU)

```bash
pip install -e ".[api,dev]"
pytest -q
python scripts/prepare_data.py --name hls_burn_scars --version 1.0 --init-layout
tune prepare -s baseline
tune --help
```

`tune train` debe responder `NotImplementedError` hasta existir el trainer.

---

## Criterio de avance real

- [ ] Layout + `tune prepare` en verde  
- [ ] Smoke del caso **o** decisión Plan B documentada en ADR 001/003  
- [ ] Al menos un PR de código hacia trainer o evaluate  
- [ ] Dos runs comparables trackeados (cierre del núcleo experimental)  
