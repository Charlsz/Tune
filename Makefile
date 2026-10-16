# Comandos de la aplicación. Otros objetivos técnicos quedan disponibles
# pero no se listan: el uso diario son solo app-up, app-logs y app-down.

.PHONY: help app-up app-down app-logs app-up-gpu eo-pull-base gpu gpu-rebuild gpu-logs gpu-down examples install install-all lint format test test-int clean lab-experiment lab-experiment-full lab-experiment-smoke lab-up lab-down lab-preflight validate-sites piloto web-dev

# On Windows, GNU Make defaults to cmd.exe, which cannot run bash recipes.
# Prefer Git Bash when present so `make app-up` works in PowerShell.
ifeq ($(OS),Windows_NT)
  GIT_BASH := $(wildcard C:/Progra~1/Git/bin/bash.exe)
  ifneq ($(GIT_BASH),)
    SHELL := $(GIT_BASH)
    .SHELLFLAGS := -c
  endif
endif

PYTHON ?= python
export DOCKER_BUILDKIT ?= 1
export COMPOSE_DOCKER_CLI_BUILD ?= 1
export BUILDKIT_PROGRESS ?= plain

help:
	@echo "Comandos de la aplicacion:"
	@echo "  make app-up    Levanta API y web en Docker (http://localhost:8080)"
	@echo "  make app-logs  Muestra los logs de la API en tiempo real"
	@echo "  make app-down  Detiene y apaga los contenedores"

EO_BASE := pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime
EO_BASE_OK := docker run --rm $(EO_BASE) python -I -S -c \
	"import traceback, types; traceback.format_exception; types.GenericAlias"

eo-pull-base:
	@echo "==> docker pull $(EO_BASE)"
	docker pull $(EO_BASE)
	@$(EO_BASE_OK) >/dev/null 2>&1 || { \
		echo "==> Imagen base danada; se borra y se vuelve a bajar"; \
		docker rmi -f $(EO_BASE) && docker builder prune -af && docker pull $(EO_BASE) && \
		$(EO_BASE_OK); \
	}

app-up: eo-pull-base
	@test -f .env || cp .env.example .env
	docker compose up -d --build
	@echo "Web: http://localhost:$${WEB_PORT:-8080}"
	@echo "API: http://localhost:$${API_PORT:-8000}/docs"
	@echo "Logs: make app-logs   Apagar: make app-down"

app-down:
	docker compose down

app-logs:
	docker compose logs -f eo-api

# --- Objetivos tecnicos (no listados en help) ---------------------------------

app-up-gpu: eo-pull-base
	@test -f .env || cp .env.example .env
	docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build

NATIVE := docker --context default
GPU_COMPOSE := $(NATIVE) compose -f docker-compose.yml -f docker-compose.gpu.yml

gpu:
	@test -f .env || cp .env.example .env
	@$(NATIVE) info --format '{{json .Runtimes}}' 2>/dev/null | grep -q nvidia || { \
		echo "Docker nativo sin runtime nvidia."; exit 1; }
	@$(NATIVE) image inspect tune-eo-api >/dev/null 2>&1 || { \
		docker --context desktop-linux save tune-eo-api tune-web | $(NATIVE) load; }
	$(GPU_COMPOSE) up -d

gpu-rebuild:
	@test -f .env || cp .env.example .env
	docker --context desktop-linux compose build eo-api web
	docker --context desktop-linux save tune-eo-api tune-web | $(NATIVE) load
	$(GPU_COMPOSE) up -d --force-recreate

gpu-logs:
	$(GPU_COMPOSE) logs -f eo-api

gpu-down:
	$(GPU_COMPOSE) down

HF := https://huggingface.co/ibm-nasa-geospatial
EXAMPLES := \
	Prithvi-EO-2.0-300M-TL-Sen1Floods11/resolve/main/examples/India_900498_S2Hand.tif \
	Prithvi-EO-2.0-300M-TL-Sen1Floods11/resolve/main/examples/Spain_7370579_S2Hand.tif \
	Prithvi-EO-2.0-300M-TL-Sen1Floods11/resolve/main/examples/USA_430764_S2Hand.tif \
	Prithvi-EO-2.0-300M-BurnScars/resolve/main/examples/subsetted_512x512_HLS.S30.T10SEH.2018190.v1.4_merged.tif \
	Prithvi-EO-2.0-300M-BurnScars/resolve/main/examples/subsetted_512x512_HLS.S30.T10SFF.2018190.v1.4_merged.tif \
	Prithvi-EO-2.0-300M-BurnScars/resolve/main/examples/subsetted_512x512_HLS.S30.T10SGF.2020217.v1.4_merged.tif

examples:
	@for f in $(EXAMPLES); do \
		out="examples/$$(basename $$f)"; \
		test -s "$$out" || curl -fL --retry 3 -o "$$out" "$(HF)/$$f"; \
	done
	@ls -lh examples/*.tif

web-dev:
	cd web && npm install && npm run dev

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

validate-sites:
	$(PYTHON) scripts/validate_sites.py --api http://localhost:$${API_PORT:-8000}

piloto: validate-sites

clean:
	rm -rf .pytest_cache .ruff_cache htmlcov .coverage
	find . -type d -name __pycache__ -prune -exec rm -rf {} +

lab-experiment lab-experiment-full lab-experiment-smoke lab-up lab-down lab-preflight:
	$(MAKE) -C lab $(patsubst lab-%,%,$@)
