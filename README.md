<div align="center">
  <img src="web/public/icons/tune-lightmode.svg#gh-light-mode-only" alt="Tune Logo" width="40%">
  <img src="web/public/icons/tune-darkmode.svg#gh-dark-mode-only" alt="Tune Logo" width="40%">
</div>

# Tune

## Resumen ejecutivo

Tune es un prototipo académico de análisis satelital de **inundación**. Surge en el contexto de foundation models geoespaciales ya especializados (Prithvi-EO 2.0 / Sen1Floods11): el modelo detecta agua, pero un cauce en época seca no debe presentarse como desborde.

La oportunidad es cerrar el ciclo desde una escena Sentinel-2 (o GeoTIFF) hasta un **análisis recuperable**: agua detectada, **agua nueva** frente a una referencia (historial del territorio o Global Surface Water del European Commission's Joint Research Centre (JRC)), acuerdo con Copernicus Global Flood Monitoring (GFM) cuando hay capa, y exposición (WorldCover de la European Space Agency (ESA) / población del Global Human Settlement Layer (GHSL)). El alcance es una aplicación cliente-servidor (FastAPI + React/MapApp) reproducible con Docker, validada en sitios de demostración, no un producto comercial ni un Geographic Information System (GIS) de propósito general.

El valor aportado es una lectura defendible de inundación como **cambio hídrico**, con trazabilidad al checkpoint usado y documentación de ingeniería e informes del curso en este repositorio.

## Documentación del repositorio

### Primer informe

- [Primer Informe](./docs/PrimerInforme.md): Documento que presenta el planteamiento del problema, los objetivos, la solución propuesta, el estado del arte, la metodología de desarrollo y el plan de trabajo del proyecto.

### Segundo informe

- [Segundo Informe](./docs/SegundoInforme.md): Documento que presenta el estado actual del proyecto, incluyendo los avances logrados, las validaciones realizadas y los aspectos pendientes.

### Informe final

| Documento | Descripción |
|---|---|
| [InformeFinal.md](./docs/InformeFinal.md) | Documento principal del proyecto |
| [Instalación.md](./docs/Instalación.md) | Guía de instalación, desarrollo y despliegue |
| [Desarrollo.md](./docs/Desarrollo.md) | Detalles técnicos del desarrollo |

Índice ampliado (guía de uso, Architecture Decision Records (ADRs), validación): [docs/README.md](./docs/README.md).

## Estudiantes

| Nombre | GitHub |
|---|---|
| Carlos Andrés Galvis Pájaro | [@Charlsz](https://github.com/Charlsz) |
| Zenen Contreras Royero | [@zenencontreras](https://github.com/zenencontreras) |
