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
    tune_data_dir: Path = Path("./data")
    tune_configs_dir: Path = Path("./configs")
    tune_artifacts_dir: Path = Path("./artifacts")


@lru_cache
def get_settings() -> Settings:
    return Settings()
