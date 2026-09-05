"""Capa de aplicación: casos de uso = stages del pipeline (ADR 002).

``prepare → train → evaluate → register → compare``

Cada stage recibe sus puertos por constructor (inyección de dependencias) y no
conoce implementaciones concretas. La composición ocurre en
``tune.infrastructure.container``.
"""
