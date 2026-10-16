# Instalación de Tune

Tune analiza inundación en imágenes satelitales con el checkpoint Prithvi-EO 2.0 de Sen1Floods11.

Para el flujo completo de uso (escenas, mapa, resultados), lee [GuiaDeUso.md](./GuiaDeUso.md).

## Requisitos

- Git
- Docker Desktop con Docker Compose (CPU basta; GPU opcional)
- En Windows: GNU Make (`winget install ezwinports.make`) y Git for Windows (el Makefile usa bash)

## Levantar, ver logs y apagar

```bash
git clone https://github.com/Charlsz/Tune.git
cd Tune
cp .env.example .env
make app-up
make app-logs
make app-down
```

| Comando | Efecto |
|---|---|
| `make app-up` | Construye y levanta API + web |
| `make app-logs` | Logs de la API en tiempo real |
| `make app-down` | Detiene y elimina contenedores |

- Web: http://localhost:8080
- API: http://localhost:8000/docs

La primera inferencia descarga ~1,2 GB de pesos. Quedan cacheados. Los análisis en disco se conservan al apagar.

### Si `make` no existe en PowerShell

```powershell
winget install ezwinports.make
# Cierra y abre la terminal para refrescar el PATH
```

Equivalente sin Make (mismo efecto que `app-up`):

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d --build
```

## Desarrollo local opcional

Entorno virtual, `pip install -e ".[api,dev]"`, `pytest -m "not gpu"`. Frontend: `npm run dev` en `web/` con la API en el puerto 8000. Detalle en [Desarrollo.md](./Desarrollo.md) y [architecture/v2.md](./architecture/v2.md).
