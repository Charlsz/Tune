# Guía de uso de Tune

Documento para entender la aplicación de punta a punta: qué hace, cómo levantarla, cómo probar y cómo leer un resultado.

## 1. En una frase

Tune toma escenas Sentinel-2 del mismo lugar en dos fechas (**Antes** / **Después**), detecta **agua** con Prithvi-EO 2.0 (Sen1Floods11) y calcula **inundación = agua nueva** frente a la línea base (historial del territorio o Global Surface Water del European Commission's Joint Research Centre (JRC)). Si Copernicus Global Flood Monitoring (GFM) tiene capa para esa zona y fecha, muestra el **acuerdo** (Intersection over Union (IoU) + capa).

## 2. Cómo levantarla

Necesitas Git y Docker Desktop (con el motor Linux / Windows Subsystem for Linux 2 (WSL2) en Windows).

```bash
cd Tune
cp .env.example .env   # solo la primera vez
make app-up            # construye y levanta
```

| Qué | Dónde |
|---|---|
| Web (MapApp) | http://localhost:8080 |
| Application Programming Interface (API) (Swagger) | http://localhost:8000/docs |
| Logs | `make app-logs` |
| Apagar | `make app-down` |

En Windows PowerShell hace falta GNU Make (por ejemplo `winget install ezwinports.make`) y Git Bash: el Makefile usa bash.

La primera inferencia descarga ~1,2 GB de pesos desde Hugging Face (caché Docker).

## 3. Cómo usar la web (MapApp)

Flujo del panel: **Área → Fechas → Imágenes → Comparación → Resultado**.

1. Elige el lugar (búsqueda, coordenadas o dibujo en el mapa).
2. Define fecha **Antes** (línea base) y **Después** (pico).
3. Consulta escenas Sentinel-2 y elige una por fecha.
4. **Analizar**: Tune corre Prithvi en ambas; la segunda usa la primera como `history_baseline` cuando aplica.
5. En el resultado, modos del mapa:

| Modo | Qué muestra |
|---|---|
| **Antes** / **Después** | Preview + máscara de agua |
| **Cambio** | Rojo = nueva (inundación), azul = permanente, gris = retirada |
| **Acuerdo** | Capa GFM (Global Flood Monitoring) vs Tune (si hubo dato); si no, el botón queda desactivado |

Métricas del panel: detectada, nueva, permanente, retirada, población (si hay), **Acuerdo GFM** (IoU o “—”). Una nota indica si GFM estuvo disponible, vacío o con error.

### Historial (pestaña)

Solo guarda **comparaciones de esta sesión** en el navegador. El servidor sí persiste cada análisis (`artifacts/analyses/`) para la línea base y para `GET /api/analyses`; MapApp no lista ese historial API todavía.

## 4. GFM (Global Flood Monitoring, Copernicus)

En cada análisis de inundación el backend consulta el SpatioTemporal Asset Catalog (STAC) del Earth Observation Data Centre (EODC) (colección `GFM`, ventana ±10 días respecto a la fecha de la escena). Sin API key. Si no hay ítem o EODC falla, el análisis sigue con `fusion: null` y el modo Acuerdo desactivado.

Flag: `TUNE_OBSERVE_GFM=true` en `.env` (por defecto).

## 5. Cómo probar sin la User Interface (UI)

```bash
pytest -m "not gpu"

# Par Pakistán (base → pico)
curl -X POST "http://localhost:8000/api/catalog/S2B_42RVR_20220518_0_L2A/analyze" \
  -F task=flood -F lat=27.70 -F lon=68.85 -F side_km=12 -F max_cloud=40
curl -X POST "http://localhost:8000/api/catalog/S2B_42RVR_20220905_0_L2A/analyze" \
  -F task=flood -F lat=27.70 -F lon=68.85 -F side_km=12 -F max_cloud=40
```

Pares STAC y capturas: [validation/casos-demostracion.md](./validation/casos-demostracion.md), [validation/sitios-resultados.md](./validation/sitios-resultados.md).

## 6. Mapa de documentación

| Documento | Para qué |
|---|---|
| [Instalación.md](./Instalación.md) | Requisitos y comandos diarios |
| [Desarrollo.md](./Desarrollo.md) | Código, tests, estructura |
| [architecture/v2.md](./architecture/v2.md) | Arquitectura hexagonal |
| [decisions/](./decisions/) | Architecture Decision Records (ADRs) (010 cambio, 014 fusión, 015 exposición) |
