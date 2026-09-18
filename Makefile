# Atajos de desarrollo. En Windows: Git Bash / WSL, o los comandos docker a mano.

.PHONY: help install install-all lint format test test-int up down logs mlflow api train smoke-build smoke-data smoke-run smoke-down lab-up lab-down lab-train lab-run lab-data lab-data-smoke lab-eo-smoke lab-experiment lab-experiment-full pipeline clean

PYTHON ?= python
STRATEGY ?= baseline

help:
	@echo "lab-experiment       — UN comando lab U: up + datos + train smoke + down"
	@echo "lab-experiment-full  — igual pero dataset completo + train full"
	@echo "lab-up / lab-down    — solo encender/apagar (pasos sueltos)"
	@echo "smoke-*              — prueba CPU sin NVIDIA"
	@echo "install / test / lint"

# --- Lab universidad: un solo comando ---
# Encadena: build/up → descargar subset → baseline+optimized → apagar siempre.
lab-experiment:
	@test -f .env || cp .env.example .env
	@echo "==> [1/4] lab-up (MLflow + API + imagen GPU)"
	@$(MAKE) lab-up
	@echo "==> [2/4] lab-data-smoke (Burn Scars subset)"
	@$(MAKE) lab-data-smoke
	@echo "==> [3/4] lab-eo-smoke (baseline + optimized)"
	@status=0; \
	$(MAKE) lab-eo-smoke || status=$$?; \
	echo "==> [4/4] lab-down (apagar contenedores)"; \
	$(MAKE) lab-down; \
	exit $$status

# Dataset completo + pipeline configs/training (mas largo / mas disco).
lab-experiment-full:
	@test -f .env || cp .env.example .env
	@echo "==> [1/4] lab-up"
	@$(MAKE) lab-up
	@echo "==> [2/4] lab-data (corpus completo)"
	@$(MAKE) lab-data
	@echo "==> [3/4] lab-run (baseline + optimized full)"
	@status=0; \
	$(MAKE) lab-run || status=$$?; \
	echo "==> [4/4] lab-down"; \
	$(MAKE) lab-down; \
	exit $$status

lab-up:
	@test -f .env || cp .env.example .env
	docker compose --profile training up -d --build mlflow api
	docker compose --profile training build training
	@echo ""
	@echo "Lab listo. MLflow http://localhost:5000  API http://localhost:8000/health"
	@echo "Todo-en-uno: make lab-experiment"

lab-down:
	docker compose --profile training --profile smoke down

lab-data:
	docker compose --profile training run --rm training \
		python scripts/prepare_data.py --name hls_burn_scars --version 1.0 --download-burn-scars

lab-data-smoke:
	docker compose --profile training run --rm training \
		python scripts/prepare_data.py --name hls_burn_scars --version 1.0 --download-burn-scars --max-files 8

lab-eo-smoke:
	docker compose --profile training run --rm \
		-e TUNE_CONFIGS_DIR=/app/configs/eo_smoke \
		-e TUNE_TRACKER=json \
		training tune run -s baseline -s optimized

lab-train:
	docker compose --profile training run --rm training tune train -s $(STRATEGY)

lab-run:
	docker compose --profile training run --rm training tune run -s baseline -s optimized

smoke-build:
	docker compose --profile smoke build training-cpu

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
