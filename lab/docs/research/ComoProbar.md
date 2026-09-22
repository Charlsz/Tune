# Cómo probar Tune

**En una frase:** Tune no inventa modelos; **fine-tunea modelos ya preentrenados**, registra baseline vs optimized y deja evidencia comparable.

`docs/PrimerInforme.md` está **congelado** (entrega 2026-08-29). Este documento es el protocolo vivo de pruebas del **laboratorio**.

---

## Qué entiendo Tune hace

1. Tomas un **modelo ya creado** (p. ej. ResNet18/ImageNet o Prithvi).  
2. Lo adaptas a un dataset (fine-tuning).  
3. Lo haces **dos veces**: estrategia cara (baseline) y barata (optimized).  
4. Mides tiempo/memoria y calidad.  
5. Guardas la corrida y puedes servir el modelo.

No entrenamos “una red desde cero como producto”. El producto es el **laboratorio** que hace comparable ese proceso.

---

## A. En tu PC — solo Docker (recomendado)

Requisito: Docker Desktop **encendido**. En este repo el smoke CPU no necesita NVIDIA.

```bash
# desde la raíz del repo
cp .env.example .env
make -C lab smoke-build
make -C lab smoke-data
make -C lab smoke-run
make -C lab smoke-down
```

**Qué usa el smoke**

| Pieza | Valor |
|-------|--------|
| Modelo preentrenado | `torchvision` ResNet18 (ImageNet) — ya publicado |
| Dataset | CIFAR-10 reducido (cabe en CPU / 8 GB RAM) |
| Baseline | fine-tune completo 1 epoch |
| Optimized | solo cabeza (`freeze_backbone`) 1 epoch |
| Tracker | JSON en `artifacts/` (sin MLflow) |

¿Por qué no Burn Scars/Prithvi aquí? Necesitan ~16 GB GPU. El smoke valida el **método Tune**; el caso científico va en B/C.

Opcional — MLflow + API (también apagar después):

```bash
cd lab && docker compose up -d mlflow api
# http://localhost:5000  ·  http://localhost:8001/health
docker compose down
```

---

## B. Free-tier (Colab / Kaggle) — caso científico

1. Cuenta en [Colab](https://colab.research.google.com) o [Kaggle](https://www.kaggle.com) (GPU).  
2. Abrir el notebook Burn Scars / Prithvi (enlace en Notion / Research).  
3. Runtime GPU T4. Smoke: 1 epoch, subset, batch 1–2.  
4. Anotar VRAM, tiempo, métrica.  
5. Si OOM → Plan B (mismo pipeline Tune, modelo más chico).  

Luego se cablea el trainer de segmentación al repo (misma CLI `tune train`).

---

## C. Lab universidad (AnyDesk) — solo `main` + un comando

**Flujo del equipo**

| Dónde | Qué |
|-------|-----|
| Desarrollo (casa / Cursor) | Ramas `feat/*` → tests → PR → merge a `main` |
| Máquina U (AnyDesk) | **Solo** `git pull` de `main` + Docker. Sin feature branches aquí |

**Hardware de referencia (lab):** RTX 4000 Ada 20 GB · 64 GB RAM · Ubuntu 24.04.  
**Modelo 1 (primero):** Prithvi-EO-2.0-300M + HLS Burn Scars (`lab/configs/training/`).  
**Modelo 2:** aún por escoger (otro EO o Plan B); mismo pipeline Tune para comparar demos.

### Sesión experimental (recomendado para entregar resultados)

```bash
cd ~/Desktop/Tune
git pull origin main
make -C lab down
make -C lab experiment
```

Detalle de la revisión: [RevisionLab.md](./RevisionLab.md).

- Si el **pull/build** no avanza ~20 min → Ctrl+C (no esperar días).  
- Después del viernes / paper: `make -C lab experiment-full` (20 epochs).  
- Debug corto: `make -C lab experiment-smoke`.

Copia tiempo / VRAM / mIoU a Notion.

> Trainer: TerraTorch + Prithvi HF. Optimized = backbone congelado + FP16.

---

## Orden de evidencia

1. Smoke CPU Docker (sección A) → “el laboratorio corre”.  
2. Lab U: `make -C lab up` + smoke GPU Prithvi 1 epoch / subset → “el caso científico cabe”.  
3. Par experimental documentado (modelo 1) → tabla eficiencia vs calidad.  
4. Modelo 2 + demo/aplicación práctica.  
5. API `/predict` cuando haya modelo aprobado.

---

## Carpetas de documentación

| Dónde | Qué |
|-------|-----|
| `docs/` | Entregables del modelo de repositorio (oficiales) |
| `lab/docs/research/` | Investigación del laboratorio (este archivo, plan, revisión) |
| `docs/architecture/v2.md` | Arquitectura de la app |
| `lab/docs/architecture-v1.md` | Arquitectura del laboratorio |
| `docs/decisions/` | ADRs |
