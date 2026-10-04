"""Cada ruta publicada tiene resumen y descripción en el esquema OpenAPI."""

from tune.interfaces.api.main import app

ROUTES = (
    ("/api/tasks", "get"),
    ("/api/examples", "get"),
    ("/api/examples/{example_id}/analyze", "post"),
    ("/api/analyze", "post"),
    ("/api/catalog/search", "get"),
    ("/api/catalog/{item_id}/analyze", "post"),
    ("/api/forecast", "get"),
    ("/api/timeline", "get"),
    ("/api/timeline/series", "get"),
    ("/api/analyses", "get"),
    ("/api/analyses/{analysis_id}", "get"),
    ("/api/analyses/{analysis_id}", "delete"),
    ("/api/analyses/{analysis_a}/diff/{analysis_b}", "get"),
    ("/api/analyses/{analysis_id}/sectors", "get"),
    ("/api/analyses/{analysis_id}/{artifact}", "get"),
    ("/health", "get"),
    ("/model", "get"),
    ("/predict", "post"),
)


def test_openapi_documents_every_route() -> None:
    spec = app.openapi()
    paths = spec["paths"]
    documented = {(path, method) for path, ops in paths.items() for method in ops}
    assert documented == set(ROUTES)
    for path, method in ROUTES:
        operation = paths[path][method]
        assert operation.get("summary"), path
        assert operation.get("description"), path
