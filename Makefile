# Atajos de desarrollo. En Windows: Git Bash / WSL, o los comandos docker a mano.

.PHONY: help install install-all lint format test test-int up down logs mlflow api train smoke-build smoke-data smoke-run smoke-down lab-up lab-down lab-train lab-run lab-data lab-data-smoke lab-eo-smoke pipeline clean

PYTHON ?= python
STRATEGY ?= baseline

help:
	@echo "lab-up / lab-down / lab-data / lab-eo-smoke / lab-train / lab-run  — GPU universidad"
	@echo "smoke-build / smoke-data / smoke-run / smoke-down                  — prueba CPU"
	@echo "up / down / install / test / lint"

lab-up:
	@test -f .env || cp .env.example .env
	docker compose --profile training up -d --build mlflow api
	docker compose --profile training build training
	@echo ""
	@echo "Lab listo. MLflow http://localhost:5000  API http://localhost:8000/health"
	@echo "Datos EO:  make lab-data   (o make lab-data-smoke)"
	@echo "Smoke EO:  make lab-eo-smoke"
	@echo "Full:      make lab-run"
	@echo "Apagar:    make lab-down"

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
