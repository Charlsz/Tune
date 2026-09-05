# Atajos de desarrollo. En Windows usar `make` desde Git Bash / WSL,
# o ejecutar los comandos equivalentes a mano.

.PHONY: help install install-all lint format test test-int up down logs mlflow api train pipeline clean

PYTHON ?= python
STRATEGY ?= baseline

help:
	@echo "install      Instala el paquete en modo editable (núcleo + api + dev)"
	@echo "install-all  Igual que install pero incluye tracking y training (torch)"
	@echo "lint         ruff check"
	@echo "format       ruff format + fix"
	@echo "test         pytest unitarios (sin GPU, sin servicios)"
	@echo "test-int     pytest incluyendo integración (API en proceso)"
	@echo "up           docker compose up (mlflow + api)"
	@echo "down         docker compose down"
	@echo "logs         docker compose logs -f"
	@echo "mlflow       Solo el servicio mlflow"
	@echo "api          Solo el servicio api"
	@echo "train        Entrenar con STRATEGY=baseline|optimized dentro del contenedor training"
	@echo "pipeline     Pipeline completo en local: prepare→train→evaluate→register→compare"

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
