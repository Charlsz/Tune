# Laboratorio de fine-tuning. Invocar desde la raíz: make -C lab experiment
# (o make lab-experiment). Requiere ../.env.

.PHONY: help preflight pull-base up down data data-smoke eo-smoke run-friday train run experiment experiment-full experiment-smoke smoke-build smoke-data smoke-run smoke-down

STRATEGY ?= baseline
export DOCKER_BUILDKIT ?= 1
export COMPOSE_DOCKER_CLI_BUILD ?= 1
export BUILDKIT_PROGRESS ?= plain

help:
	@echo "  experiment        — Prithvi 2 epochs (recomendado)"
	@echo "  experiment-full   — 20 epochs"
	@echo "  experiment-smoke  — subset debug"
	@echo "  down / smoke-run"

preflight:
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
	@echo "Pasos esperados de experiment:"
	@echo "  1) pull imagen PyTorch (puede tardar; vigilar %)"
	@echo "  2) build training (apt + pip terratorch)"
	@echo "  3) datos Burn Scars: tar.gz 2.6G + extraccion (se omite si ya estan)"
	@echo "  4) train baseline + optimized (2 epochs)"
	@echo "  5) apagar contenedores"

pull-base:
	@echo "==> docker pull pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime"
	@echo "    Si en 20 minutos no baja el %, Ctrl+C y avisa (red del lab)."
	docker pull pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime

up: pull-base
	@test -f ../.env || cp ../.env.example ../.env
	@echo "==> levantando MLflow + API del laboratorio"
	docker compose up -d --build mlflow api
	@echo "==> construyendo imagen training (GPU). Logs en texto plano."
	docker compose --profile training build --progress=plain training
	@echo ""
	@echo "Lab listo. MLflow http://localhost:5000  API lab http://localhost:8001/health"

down:
	docker compose --profile training --profile smoke down

data:
	@if [ -f data/hls_burn_scars/1.0/metadata.yaml ] && [ -f data/hls_burn_scars/1.0/splits/train.txt ] && ls data/hls_burn_scars/1.0/data/*_merged.tif >/dev/null 2>&1; then \
		echo "==> Burn Scars ya en data/hls_burn_scars/1.0 ($$(ls data/hls_burn_scars/1.0/data/*_merged.tif | wc -l) escenas) — se omite descarga"; \
	else \
		echo "==> descargando Burn Scars (HF)..."; \
		docker compose --profile training run --rm training \
			python scripts/prepare_data.py --name hls_burn_scars --version 1.0 --download-burn-scars; \
	fi

data-smoke:
	docker compose --profile training run --rm training \
		python scripts/prepare_data.py --name hls_burn_scars --version 1.0 --download-burn-scars --max-files 8

eo-smoke:
	docker compose --profile training run --rm \
		-e TUNE_CONFIGS_DIR=/app/configs/eo_smoke \
		-e TUNE_TRACKER=json \
		training tune run -s baseline -s optimized

run-friday:
	docker compose --profile training run --rm \
		-e TUNE_CONFIGS_DIR=/app/configs/eo_friday \
		-e TUNE_TRACKER=json \
		training tune run -s baseline -s optimized

train:
	docker compose --profile training run --rm training tune train -s $(STRATEGY)

run:
	docker compose --profile training run --rm \
		-e TUNE_CONFIGS_DIR=/app/configs \
		-e TUNE_TRACKER=mlflow \
		training tune run -s baseline -s optimized

experiment: preflight
	@test -f ../.env || cp ../.env.example ../.env
	@echo "==> [1/4] up (pull base + build GPU)"
	@$(MAKE) up
	@echo "==> [2/4] data"
	@$(MAKE) data
	@echo "==> [3/4] run-friday (baseline + optimized, 2 epochs)"
	@status=0; \
	$(MAKE) run-friday || status=$$?; \
	echo "==> [4/4] down"; \
	$(MAKE) down; \
	exit $$status

experiment-full: preflight
	@test -f ../.env || cp ../.env.example ../.env
	@$(MAKE) up
	@$(MAKE) data
	@status=0; \
	$(MAKE) run || status=$$?; \
	$(MAKE) down; \
	exit $$status

experiment-smoke: preflight
	@test -f ../.env || cp ../.env.example ../.env
	@$(MAKE) up
	@$(MAKE) data-smoke
	@status=0; \
	$(MAKE) eo-smoke || status=$$?; \
	$(MAKE) down; \
	exit $$status

smoke-build:
	docker compose --profile smoke build --progress=plain training-cpu

smoke-data:
	docker compose --profile smoke run --rm training-cpu python scripts/prepare_data.py --name cifar10_smoke --version 1.0 --download-cpu-smoke

smoke-run:
	docker compose --profile smoke run --rm training-cpu tune run -s baseline -s optimized

smoke-down:
	docker compose --profile smoke down
