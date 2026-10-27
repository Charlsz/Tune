<div align="center">
  <img src="web/public/icons/tune-lightmode.svg#gh-light-mode-only" alt="Tune Logo" width="40%">
  <img src="web/public/icons/tune-darkmode.svg#gh-dark-mode-only" alt="Tune Logo" width="40%">
</div>

##

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

### Docker Compose

Desde la raíz del repo, con `.env` ya creado:

```bash
docker compose up -d --build    # construye tune-eo-api y tune-web, y los levanta
docker compose logs -f eo-api   # logs de la API
docker compose down             # apaga y borra contenedores
```

`down` conserva el volumen `hf-cache` (pesos de Hugging Face, ~1,2 GB la primera vez) y la carpeta `artifacts/`.

Esto no ejecuta la comprobación de la imagen base que hace `make app-up` (`pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime`). Compose la baja igual como primera capa del Dockerfile.

## Documentación

| Documento | Qué es |
|---|---|
| [docs/GuiaDeUso.md](./docs/GuiaDeUso.md) | Empezar con Guia de uso |
| [docs/SegundoInforme.md](./docs/SegundoInforme.md) | Segundo informe (avance actual) |
| [docs/PrimerInforme.md](./docs/PrimerInforme.md) | Planteamiento original (**congelado 2026-08-29**) |
| [docs/Instalación.md](./docs/Instalación.md) | Cómo instalar y levantar la app |
| [docs/Desarrollo.md](./docs/Desarrollo.md) | Cómo tocar el código |
| [docs/decisions/](./docs/decisions/) | ADRs |
| [lab/README.md](./lab/README.md) | Fine-tuning (secundario) |

## Estudiantes

| Nombre | GitHub |
|---|---|
| Carlos Andrés Galvis Pájaro | [@Charlsz](https://github.com/Charlsz) |
| Zenen Contreras Royero | [@zenencontreras](https://github.com/zenencontreras) |
