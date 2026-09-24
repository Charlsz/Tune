# App (núcleo). Laboratorio: make -C lab experiment  (atajos lab-* abajo).

.PHONY: help app-up app-up-gpu app-down app-logs web-dev eo-pull-base install install-all lint format test test-int clean lab-experiment lab-experiment-full lab-experiment-smoke lab-up lab-down lab-preflight

PYTHON ?= python
export DOCKER_BUILDKIT ?= 1
export COMPOSE_DOCKER_CLI_BUILD ?= 1
export BUILDKIT_PROGRESS ?= plain

help:
	@echo "APP:"
	@echo "  app-up        — API Prithvi + web  http://localhost:8080 (CPU)"
	@echo "  app-up-gpu    — igual, con GPU NVIDIA"
	@echo "  app-down / app-logs / web-dev"
	@echo "  install / test / lint"
	@echo "LAB (secundario): make -C lab experiment   o   make lab-experiment"

EO_BASE := pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime
# Un pull cortado deja la stdlib de la base truncada y pip muere con errores de
# traceback/types. Si pasa, se borra la imagen y se baja de nuevo una vez.
EO_BASE_OK := docker run --rm $(EO_BASE) python -I -S -c \
	"import traceback, types; traceback.format_exception; types.GenericAlias"

eo-pull-base:
	@echo "==> docker pull $(EO_BASE)"
	@echo "    Si en 20 minutos no baja el %, Ctrl+C (red)."
	docker pull $(EO_BASE)
	@$(EO_BASE_OK) >/dev/null 2>&1 || { \
		echo "==> Imagen base dañada; se borra y se vuelve a bajar"; \
		docker rmi -f $(EO_BASE) && docker builder prune -af && docker pull $(EO_BASE) && \
		$(EO_BASE_OK); \
	}

app-up: eo-pull-base
	@test -f .env || cp .env.example .env
	docker compose up -d --build
	@echo "Web: http://localhost:$${WEB_PORT:-8080}   API: http://localhost:$${API_PORT:-8000}/docs"

app-up-gpu: eo-pull-base
	@test -f .env || cp .env.example .env
	docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
	@echo "Web: http://localhost:$${WEB_PORT:-8080}   API: http://localhost:$${API_PORT:-8000}/docs"

app-down:
	docker compose down

app-logs:
	docker compose logs -f eo-api

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

clean:
	rm -rf .pytest_cache .ruff_cache htmlcov .coverage
	find . -type d -name __pycache__ -prune -exec rm -rf {} +

# --- Delegados al laboratorio (cwd lab/) ----------------------------------------
lab-experiment lab-experiment-full lab-experiment-smoke lab-up lab-down lab-preflight:
	$(MAKE) -C lab $(patsubst lab-%,%,$@)
