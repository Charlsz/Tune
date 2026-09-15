# Instalación y despliegue — Tune

**Proyecto:** laboratorio MLOps de fine-tuning eficiente (prototipo académico).

## 1. Qué se instala

El paquete `tune` (CLI + API + adaptadores). El entrenamiento pesado es opcional (`[training]`).

## 2. Requisitos previos

- Git, Python 3.10–3.12 (recomendado **3.11** para training)
- Opcional: Docker + Docker Compose
- GPU NVIDIA solo para entrenar (lab / Colab / Kaggle). Un PC sin GPU sirve para código, tests y API.

## 3. Instalación local (desarrollo)

```bash
git clone https://github.com/Charlsz/Tune.git
cd Tune
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
python -m pip install -U pip
pip install -e ".[api,dev]"
cp .env.example .env
pytest -q
tune --help
```

API local:

```bash
uvicorn tune.interfaces.api.main:app --reload
# GET http://127.0.0.1:8000/health
```

## 4. Con Docker

```bash
cp .env.example .env
docker compose up -d mlflow api
# MLflow http://localhost:5000
# API    http://localhost:8000/health
```

Imagen de training (máquina con NVIDIA Container Toolkit):

```bash
docker compose --profile training run --rm training tune --help
```

Hoy `tune train` falla con `NotImplementedError` hasta implementar el trainer — esperado.

## 5. Datos

Los datasets **no** van en Git. Layout:

```text
data/<name>/<version>/{train,val,test}/
data/<name>/<version>/metadata.yaml
```

Ver `data/README.md` y `scripts/prepare_data.py` (pendiente de implementación completa).

## 6. Verificación rápida

| Chequeo | Comando / URL | OK si… |
|---------|---------------|--------|
| Tests | `pytest -q` | 18 passed (u. actual) |
| CLI | `tune --help` | lista prepare/train/… |
| API | `GET /health` | JSON con version |
| Compose | `docker compose config -q` | sin error (tras `.env`) |

## 7. Entrenamiento (cuando haya GPU e implementación)

1. Smoke del caso en Colab/Kaggle (ver [research/ComoProbar.md](./research/ComoProbar.md)).
2. Preparar datos → `tune prepare -s baseline`.
3. `tune train -s baseline` con `MLFLOW_TRACKING_URI` apuntando al servidor.
4. Evaluar, registrar, comparar; luego `optimized`.

Detalle de arquitectura y gaps: [architecture/v1.md](./architecture/v1.md).

## 8. Solución de problemas

| Síntoma | Qué hacer |
|---------|-----------|
| `No module named tune` | `pip install -e ".[api,dev]"` desde la raíz |
| `docker compose` pide `.env` | `cp .env.example .env` |
| OOM en Prithvi | bajar batch; smoke subset; Plan B (ADR 001) |
| PC sin NVIDIA | no entrenar local; usar lab/Colab/Kaggle |

## 9. Referencias

- [Desarrollo.md](./Desarrollo.md)
- [research/Investigacion.md](./research/Investigacion.md)
- [research/CaminoInmediato.md](./research/CaminoInmediato.md)
- [research/ComoProbar.md](./research/ComoProbar.md)
- [docker/README.md](../docker/README.md)
