"""Capa de infraestructura: implementaciones concretas de los puertos del dominio.

Un subpaquete por preocupación técnica. Cada uno puede tener dependencias
pesadas (torch, mlflow) importadas de forma perezosa para que el núcleo, la CLI
y los tests unitarios funcionen sin ellas.
"""
