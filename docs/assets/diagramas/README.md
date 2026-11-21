# Diagramas del proyecto (Mermaid)

Equivalente a `assets/diagramas/` del [modelo del curso](https://github.com/augustosalazar/pf_modelo_repositorio).
Se renderizan en GitHub y en editores Markdown con Mermaid.

Siglas frecuentes: Global Flood Monitoring (GFM), Joint Research Centre (JRC),
SpatioTemporal Asset Catalog (STAC), Earth Observation Data Centre (EODC),
Area of Interest (AOI).

| Archivo | Contenido | Uso en informe |
|---|---|---|
| [arquitectura.md](./arquitectura.md) | Contenedores, caso de uso, externos | §10.1 |
| [interaccion-modulos.md](./interaccion-modulos.md) | Capas hexagonal | §10.1.2 |
| [secuencia-analisis.md](./secuencia-analisis.md) | Flujo Antes/Después MapApp | §10.1.3 |
| [secuencia-rechazo.md](./secuencia-rechazo.md) | Lugar o GeoTIFF que no llega a análisis | §10.1.3 |
| [secuencia-fusion.md](./secuencia-fusion.md) | Fusión GFM con capa o vacía | §10.1.3 |
| [despliegue.md](./despliegue.md) | Docker Compose, volúmenes, puertos | §12 |
