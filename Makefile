# App (núcleo). Laboratorio: make -C lab experiment  (atajos lab-* abajo).

.PHONY: help app-up app-up-gpu app-down app-logs web-dev eo-pull-base gpu gpu-rebuild gpu-logs gpu-down examples install install-all lint format test test-int clean lab-experiment lab-experiment-full lab-experiment-smoke lab-up lab-down lab-preflight

PYTHON ?= python
export DOCKER_BUILDKIT ?= 1
export COMPOSE_DOCKER_CLI_BUILD ?= 1
export BUILDKIT_PROGRESS ?= plain

help:
	@echo "APP:"
	@echo "  app-up        — API Prithvi + web  http://localhost:8080 (CPU)"
	@echo "  app-up-gpu    — igual, con GPU NVIDIA"
	@echo "  gpu           — GPU vía Docker nativo (si Docker Desktop no ve la NVIDIA)"
	@echo "  gpu-rebuild   — reconstruye eo-api + web y las reinicia en GPU"
	@echo "  examples      — baja escenas GeoTIFF de ejemplo a examples/"
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

# GPU con Docker nativo (contexto default). Docker Desktop en Linux no expone NVIDIA.
# Reusa las imágenes ya construidas en Docker Desktop para no repetir el pip.
NATIVE := docker --context default
GPU_COMPOSE := $(NATIVE) compose -f docker-compose.yml -f docker-compose.gpu.yml

gpu:
	@test -f .env || cp .env.example .env
	@$(NATIVE) info --format '{{json .Runtimes}}' 2>/dev/null | grep -q nvidia || { \
		echo "Docker nativo no responde o no tiene el runtime nvidia."; \
		echo "Probar: $(NATIVE) info   (permission denied = pedir grupo docker)"; exit 1; }
	@$(NATIVE) image inspect tune-eo-api >/dev/null 2>&1 || { \
		echo "==> Copiando imágenes de Docker Desktop al Docker nativo"; \
		docker --context desktop-linux save tune-eo-api tune-web | $(NATIVE) load; }
	$(GPU_COMPOSE) up -d
	@echo "Web: http://localhost:$${WEB_PORT:-8080}   Logs: make gpu-logs   Parar: make gpu-down"

# Reconstruye en Docker Desktop (ahí está la caché de pip) y la pasa al Docker nativo.
gpu-rebuild:
	@test -f .env || cp .env.example .env
	docker --context desktop-linux compose build eo-api web
	docker --context desktop-linux save tune-eo-api tune-web | $(NATIVE) load
	$(GPU_COMPOSE) up -d --force-recreate
	@echo "Listo. Logs: make gpu-logs"

gpu-logs:
	$(GPU_COMPOSE) logs -f eo-api

gpu-down:
	$(GPU_COMPOSE) down

HF := https://huggingface.co/ibm-nasa-geospatial
EXAMPLES := \
	Prithvi-EO-2.0-300M-TL-Sen1Floods11/resolve/main/examples/India_900498_S2Hand.tif \
	Prithvi-EO-2.0-300M-TL-Sen1Floods11/resolve/main/examples/Spain_7370579_S2Hand.tif \
	Prithvi-EO-2.0-300M-BurnScars/resolve/main/examples/subsetted_512x512_HLS.S30.T10SEH.2018190.v1.4_merged.tif

# Escenas de ejemplo (~11 MB) en examples/ para subirlas desde la web.
examples:
	@for f in $(EXAMPLES); do \
		out="examples/$$(basename $$f)"; \
		test -s "$$out" || curl -fL --retry 3 -o "$$out" "$(HF)/$$f"; \
	done
	@ls -lh examples/*.tif

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
