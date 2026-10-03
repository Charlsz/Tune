"""Excepciones de proveedores de referencia."""


class ReferenceUnavailable(RuntimeError):
    """La referencia externa no respondió (red, tile faltante, timeout)."""
