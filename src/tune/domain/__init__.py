"""Capa de dominio.

Regla: nada aquí importa torch, mlflow, fastapi ni yaml. Solo Python estándar
(dataclasses, enum, typing). Así las reglas de negocio (p. ej. la decisión de
promoción) se prueban sin GPU ni servicios.
"""
