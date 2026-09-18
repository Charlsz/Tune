# Atajos de desarrollo. En Windows: Git Bash / WSL, o los comandos docker a mano.

.PHONY: help install install-all lint format test test-int up down logs mlflow api train smoke-build smoke-data smoke-run smoke-down lab-up lab-down lab-train lab-run pipeline clean

PYTHON ?= python
STRATEGY ?= baseline

help:
	@echo "lab-up / lab-down / lab-train / lab-run             — GPU universidad (un comando)"
	@echo "smoke-build / smoke-data / smoke-run / smoke-down  — prueba CPU en Docker"
	@echo "up / down                                          — mlflow + api"
	@echo "install / test / lint                              — desarrollo local sin torch"

# --- Lab universidad (AnyDesk): solo main + Docker ---
# Un comando para levantar MLflow + API y construir la imagen GPU.
lab-up:
	@test -f .env || cp .env.example .env
	docker compose --profile training up -d --build mlflow api
	docker compose --profile training build training
	@echo ""
	@echo "Lab listo. MLflow http://localhost:5000  API http://localhost:8000/health"
	@echo "Entrenar:  make lab-train STRATEGY=baseline"
	@echo "Pipeline:  make lab-run"
	@echo "Apagar:    make lab-down"

lab-down:
	docker compose --profile training --profile smoke down

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
