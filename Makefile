# Atajos de desarrollo. En Windows: Git Bash / WSL, o los comandos docker a mano.

.PHONY: help install install-all lint format test test-int up down logs mlflow api train smoke-build smoke-data smoke-run smoke-down lab-preflight lab-up lab-down lab-train lab-run lab-data lab-data-smoke lab-eo-smoke lab-experiment lab-experiment-smoke pipeline clean

PYTHON ?= python
STRATEGY ?= baseline

help:
	@echo "lab-experiment        — UN comando lab U: Prithvi completo + down"
	@echo "lab-experiment-smoke  — prueba corta (subset, 1 epoch) si quieres validar antes"
	@echo "lab-preflight         — reloj / GPU / disco (si apt falla con not valid yet)"
	@echo "lab-up / lab-down     — solo encender/apagar"
	@echo "smoke-*               — CPU sin NVIDIA"
	@echo "install / test / lint"

# Comprueba lo tipico que rompe el build en labs (reloj atrasado, sin GPU, disco).
lab-preflight:
	@echo "==> fecha del host (si esta atrasada, apt en Docker falla)"
	@date -u; date
	@echo ""
	@echo "==> sincronizar NTP si hace falta (Ubuntu):"
	@echo "    sudo timedatectl set-ntp true"
	@echo "    sudo hwclock -s 2>/dev/null || true"
	@echo ""
	@echo "==> GPU"
	@nvidia-smi || (echo "ERROR: nvidia-smi no responde"; exit 1)
	@echo ""
	@echo "==> disco"
	@df -h . | head -n 5

# --- Lab universidad: un solo comando = caso Prithvi completo ---
lab-experiment: lab-preflight
	@test -f .env || cp .env.example .env
	@echo "==> [1/4] lab-up (MLflow + API + imagen GPU)"
	@$(MAKE) lab-up
	@echo "==> [2/4] lab-data (HLS Burn Scars completo)"
	@$(MAKE) lab-data
	@echo "==> [3/4] lab-run (baseline + optimized Prithvi)"
	@status=0; \
	$(MAKE) lab-run || status=$$?; \
	echo "==> [4/4] lab-down"; \
	$(MAKE) lab-down; \
	exit $$status

# Opcional: smoke corto (no es el experimento de tesis).
lab-experiment-smoke: lab-preflight
	@test -f .env || cp .env.example .env
	@echo "==> [1/4] lab-up"
	@$(MAKE) lab-up
	@echo "==> [2/4] lab-data-smoke"
	@$(MAKE) lab-data-smoke
	@echo "==> [3/4] lab-eo-smoke"
	@status=0; \
	$(MAKE) lab-eo-smoke || status=$$?; \
	echo "==> [4/4] lab-down"; \
	$(MAKE) lab-down; \
	exit $$status

lab-up:
	@test -f .env || cp .env.example .env
	docker compose --profile training up -d --build mlflow api
	docker compose --profile training build training
	@echo ""
	@echo "Lab listo. MLflow http://localhost:5000  API http://localhost:8000/health"
	@echo "Todo-en-uno Prithvi: make lab-experiment"

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
	docker compose --profile training run --rm \
		-e TUNE_CONFIGS_DIR=/app/configs \
		-e TUNE_TRACKER=mlflow \
		training tune run -s baseline -s optimized

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
