"""Excepciones de proveedores de referencia."""


class ReferenceUnavailableError(RuntimeError):
    """La referencia externa no respondió (red, tile faltante, timeout)."""


# Alias por claridad en mensajes antiguos
ReferenceUnavailable = ReferenceUnavailableError
