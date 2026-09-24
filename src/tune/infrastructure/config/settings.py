"""Configuración por variables de entorno (ver ``.env.example``)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # MLflow
    mlflow_tracking_uri: str = "http://localhost:5000"
    mlflow_experiment_name: str = "tune"

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    tune_model_name: str = "tune-model"
    tune_model_alias: str = "approved"

    # Rutas
    tune_data_dir: Path = Path("./lab/data")
    tune_configs_dir: Path = Path("./lab/configs")
    tune_artifacts_dir: Path = Path("./artifacts")

    # Tracker: "json" (default, sin servidor) | "mlflow" (laboratorio con MLflow)
    tune_tracker: str = "json"

    # App EO: dispositivo para Prithvi ("" = auto: cuda si hay, si no cpu)
    tune_device: str = ""
    # Orígenes permitidos para el frontend (dev Vite y nginx en compose)
    tune_cors_origins: str = "http://localhost:5173,http://localhost:8080"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.tune_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
