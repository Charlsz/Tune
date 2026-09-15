# Camino inmediato — salir del estancamiento

**Para:** reunión con el tutor y la primera semana después.  
**Regla:** no intentar “terminar Tune”. Entregar **una evidencia** por sesión.

---

## 1. Dónde estamos (honestidad técnica)

| Capa | Estado | ¿Se puede mostrar mañana? |
|------|--------|---------------------------|
| Propósito + informes | Listo | Sí (PrimerInforme, esta guía, Investigación) |
| Arquitectura código | Scaffold limpio | Sí (diagrama + `src/tune/`) |
| CLI / API / Docker / CI | Esqueleto funcional | Sí: `tune --help`, `/health`, tests, compose |
| Datos + train + evaluate | **No implementado** | No fingir corrida end-to-end |
| Comparación real baseline vs optimized | Pendiente de corridas | No |

**Mensaje al tutor:** *tenemos el laboratorio (orquestación, tracking previsto, API); falta la lógica de entrenamiento del caso y el primer smoke con GPU.*

---

## 2. Si piden “hacer algo ya” (menú de entregables)

Elegir **una** fila según el tiempo y si hay GPU ese día:

| Prioridad | Entregable en horas | Qué hacer | Evidencia |
|-----------|---------------------|-----------|-----------|
| **A** (sin GPU) | 1–2 h | Demo viva: `pytest`, `tune --help`, API `/health`, MLflow UI si Docker está | Capturas + repo en `main` |
| **B** (sin GPU) | 2–4 h | Rellenar `metadata.yaml` de ejemplo + notebook outline de exploración | Archivo en `data/` (solo metadata) o `notebooks/` |
| **C** (con GPU free-tier) | 3–6 h | Smoke Burn Scars en Colab/Kaggle (1 epoch, subset) | Notebook + `nvidia-smi` + si OOM o OK |
| **D** (después del smoke OK) | días | Implementar `prepare_data` + trainer mínimo en ramas | PR a `main` |

**No hacer mañana:** UI elaborada, segundo caso, Kubernetes, reescribir clean architecture.

---

## 3. Guion corto para la reunión

1. **Problema:** fine-tuning manual = caro, poco comparable, modelo desconectado del uso.  
2. **Tune:** laboratorio que ejecuta baseline vs optimized, registra y sirve.  
3. **Arquitectura:** capas `domain → application → infrastructure → interfaces`; caso intercambiable.  
4. **Caso preferido:** Burn Scars + Prithvi; Plan B ResNet si VRAM no da.  
5. **Compute:** PC sin NVIDIA; free-tier + GPU lab como referencia.  
6. **Pedir:** métrica primaria, umbrales, GPU lab (modelo+VRAM), ¿free-tier oficial o solo smoke?  
7. **Próximo hito:** smoke del caso + `prepare`/`train` mínimo (no demo bonita).

Llevar: [003-propuesta-fase0-tutor.md](./decisions/003-propuesta-fase0-tutor.md).

---

## 4. Orden de implementación (post-acuerdos)

```text
1. Acuerdos tutor → actualizar thresholds.yaml + ADR 001
2. Smoke caso (Colab/Kaggle o lab) → decidir A / floods / Plan B
3. prepare_data.py + layout data/ + tune prepare
4. LightningTrainer + ResourceProbe → tune train (baseline)
5. Evaluator → tune evaluate
6. Completar MlflowTracker.get_run → register / compare
7. tune train -s optimized → tabla comparación
8. /predict + demo mínima
9. Informe / Segundo informe con evidencia
```

**Dueños sugeridos**

- Carlos: MLflow, API, Docker, CI, registry, ADR 003  
- Zenen: datos, trainer, métricas de tarea, notebooks  

Ramas nuevas `feat/…` desde `main`; no tocar ramas ajenas; PR con tests verdes.

---

## 5. Comandos de “prueba de vida” (hoy, sin GPU)

```bash
python -m pip install -e ".[api,dev]"
pytest -q
tune --help
cp .env.example .env
# si hay Docker:
docker compose up -d mlflow api
# http://localhost:5000  ·  http://localhost:8000/health
```

Esperado: tests OK, CLI responde, `/health` 200.  
`tune train` **debe** fallar con `NotImplementedError` hasta implementar el trainer — eso es correcto, no un bug de instalación.

---

## 6. Definición de “avance real” esta semana

- [ ] Respuestas del tutor anotadas en la propuesta  
- [ ] Cuenta Kaggle y/o Colab lista  
- [ ] Smoke del caso **o** decisión documentada de Plan B  
- [ ] Al menos un PR de código o datos hacia el trainer/prepare (no solo docs)

Si solo hay docs, el proyecto sigue estancado en scaffold. La investigación ya está; el siguiente paso es **cómputo + implementación mínima**.
