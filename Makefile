# Atajos de desarrollo. En Windows: Git Bash / WSL, o los comandos docker a mano.

.PHONY: help install install-all lint format test test-int up down logs mlflow api train smoke-build smoke-data smoke-run smoke-down lab-preflight lab-pull-base lab-up lab-down lab-train lab-run lab-run-friday lab-data lab-data-smoke lab-eo-smoke lab-experiment lab-experiment-full lab-experiment-smoke pipeline clean

PYTHON ?= python
STRATEGY ?= baseline
export DOCKER_BUILDKIT ?= 1
export COMPOSE_DOCKER_CLI_BUILD ?= 1
export BUILDKIT_PROGRESS ?= plain

help:
	@echo "lab-experiment        — RECOMENDADO viernes: Prithvi 2 epochs + down"
	@echo "lab-experiment-full   — 20 epochs (despues del viernes / paper)"
	@echo "lab-experiment-smoke  — prueba corta subset (opcional)"
	@echo "lab-preflight / lab-pull-base / lab-up / lab-down"
	@echo "smoke-* / install / test / lint"

lab-preflight:
	@echo "==> fecha"
	@date -u; date
	@echo ""
	@echo "==> GPU"
	@nvidia-smi || (echo "ERROR: nvidia-smi no responde"; exit 1)
	@echo ""
	@echo "==> disco (necesitas >20G libres; si el build no avanza en 20 min: Ctrl+C)"
	@df -h . | head -n 5
	@avail=$$(df -P . | awk 'NR==2 {print $$4}'); \
	if [ "$$avail" -lt 20000000 ]; then \
	  echo "AVISO: menos de ~20G libres. Libera disco antes de construir la imagen GPU."; \
	fi
	@echo ""
	@echo "Pasos esperados de lab-experiment:"
	@echo "  1) pull imagen PyTorch (puede tardar; vigilar %)"
	@echo "  2) build training (apt + pip terratorch)"
	@echo "  3) datos Burn Scars: tar.gz 2.6G + extraccion (se omite si ya estan)"
	@echo "  4) train baseline + optimized (2 epochs)"
	@echo "  5) apagar contenedores"

# Baja la base CUDA aparte para ver progreso (aqui se cuelgan los labs lentos).
lab-pull-base:
	@echo "==> docker pull pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime"
	@echo "    Si en 20 minutos no baja el %, Ctrl+C y avisa (red del lab)."
	docker pull pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime

lab-up: lab-pull-base
	@test -f .env || cp .env.example .env
	@echo "==> levantando MLflow + API"
	docker compose --profile training up -d --build mlflow api
	@echo "==> construyendo imagen training (GPU). Logs en texto plano."
	docker compose --profile training build --progress=plain training
	@echo ""
	@echo "Lab listo. MLflow http://localhost:5000  API http://localhost:8000/health"

lab-down:
	docker compose --profile training --profile smoke down

# Omite descarga si el layout EO ya existe CON geotiffs (una carpeta data/ vacía no cuenta).
lab-data:
	@if [ -f data/hls_burn_scars/1.0/metadata.yaml ] && [ -f data/hls_burn_scars/1.0/splits/train.txt ] && ls data/hls_burn_scars/1.0/data/*_merged.tif >/dev/null 2>&1; then \
		echo "==> Burn Scars ya en data/hls_burn_scars/1.0 ($$(ls data/hls_burn_scars/1.0/data/*_merged.tif | wc -l) escenas) — se omite descarga"; \
	else \
		echo "==> descargando Burn Scars (HF)..."; \
		docker compose --profile training run --rm training \
			python scripts/prepare_data.py --name hls_burn_scars --version 1.0 --download-burn-scars; \
	fi

lab-data-smoke:
	docker compose --profile training run --rm training \
		python scripts/prepare_data.py --name hls_burn_scars --version 1.0 --download-burn-scars --max-files 8

lab-eo-smoke:
	docker compose --profile training run --rm \
		-e TUNE_CONFIGS_DIR=/app/configs/eo_smoke \
		-e TUNE_TRACKER=json \
		training tune run -s baseline -s optimized

lab-run-friday:
	docker compose --profile training run --rm \
		-e TUNE_CONFIGS_DIR=/app/configs/eo_friday \
		-e TUNE_TRACKER=json \
		training tune run -s baseline -s optimized

lab-train:
	docker compose --profile training run --rm training tune train -s $(STRATEGY)

lab-run:
	docker compose --profile training run --rm \
		-e TUNE_CONFIGS_DIR=/app/configs \
		-e TUNE_TRACKER=mlflow \
		training tune run -s baseline -s optimized

# --- RECOMENDADO para el viernes: Prithvi real, 2 epochs, datos ya bajados ---
lab-experiment: lab-preflight
	@test -f .env || cp .env.example .env
	@echo "==> [1/4] lab-up (pull base + build GPU)"
	@$(MAKE) lab-up
	@echo "==> [2/4] lab-data"
	@$(MAKE) lab-data
	@echo "==> [3/4] lab-run-friday (baseline + optimized, 2 epochs)"
	@status=0; \
	$(MAKE) lab-run-friday || status=$$?; \
	echo "==> [4/4] lab-down"; \
	$(MAKE) lab-down; \
	exit $$status

# 20 epochs (paper). Solo despues de tener resultados del viernes.
lab-experiment-full: lab-preflight
	@test -f .env || cp .env.example .env
	@$(MAKE) lab-up
	@$(MAKE) lab-data
	@status=0; \
	$(MAKE) lab-run || status=$$?; \
	$(MAKE) lab-down; \
	exit $$status

lab-experiment-smoke: lab-preflight
	@test -f .env || cp .env.example .env
	@$(MAKE) lab-up
	@$(MAKE) lab-data-smoke
	@status=0; \
	$(MAKE) lab-eo-smoke || status=$$?; \
	$(MAKE) lab-down; \
	exit $$status

smoke-build:
	docker compose --profile smoke build --progress=plain training-cpu

smoke-data:
	docker compose --profile smoke run --rm training-cpu python scripts/prepare_data.py --name cifar10_smoke --version 1.0 --download-cpu-smoke

smoke-run:
	docker compose --profile smoke run --rm training-cpu tune run -s baseline -s optimized

smoke-down:
	docker compose --profile smoke down

install:
	$(PYTHON) -m pip install -e ".[api,dev]"

install-all:
	$(PYTHON) -m pip install -e ".[api,tracking,training,dev]"

lint:
	ruff check .
	ruff format --check .

format:
	ruff format .
	ruff check --fix .

test:
	pytest -m "not integration and not gpu"

test-int:
	pytest -m "not gpu"

up:
	docker compose up -d --build mlflow api

down:
	docker compose down

logs:
	docker compose logs -f

mlflow:
	docker compose up -d mlflow

api:
	docker compose up -d --build api

train:
	docker compose --profile training run --rm training tune train --strategy $(STRATEGY)

pipeline:
	tune run --strategy baseline --strategy optimized

clean:
	rm -rf .pytest_cache .ruff_cache htmlcov .coverage
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
