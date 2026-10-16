# Tune

Aplicación de análisis satelital de inundación con los modelos Prithvi-EO 2.0 publicados por IBM-NASA. Se sube un GeoTIFF o se busca una escena Sentinel-2 por coordenada. El modelo detecta agua, y Tune calcula inundación como agua nueva frente a una referencia permanente (JRC o historial). Cuando hay dato, compara con Copernicus GFM y resume cobertura y población sobre el agua nueva.

La misma infraestructura admite, de forma secundaria, cicatriz de incendio con el checkpoint Burn Scars. El núcleo del proyecto y de la demostración es inundación.

## Cómo levantar la app

```bash
cp .env.example .env
make app-up      # levanta API y web
make app-logs    # sigue los logs (primera vez descarga pesos)
make app-down    # apaga todo
```

- Web: http://localhost:8080
- API: http://localhost:8000/docs

Documentación: empieza por [docs/GuiaDeUso.md](./docs/GuiaDeUso.md). También [Instalación](./docs/Instalación.md), [Segundo informe](./docs/SegundoInforme.md) y [arquitectura](./docs/architecture/v2.md).

Repo: https://github.com/Charlsz/Tune
