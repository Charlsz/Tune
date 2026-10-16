# Guía de uso de Tune

Documento para entender la aplicación de punta a punta: qué hace, cómo levantarla, cómo probar y cómo leer un resultado.

## 1. En una frase

Tune toma una imagen satelital, detecta **agua** con el checkpoint Prithvi-EO 2.0 (Sen1Floods11) y calcula **inundación = agua nueva**: agua del modelo menos agua permanente (JRC Global Surface Water o historial del mismo lugar). Si hay producto operativo (Copernicus GFM), muestra el acuerdo.

La cicatriz de incendio existe como tarea auxiliar con otro checkpoint; la demostración principal es inundación.

## 2. Cómo levantarla

Necesitas Git y Docker Desktop (con el motor Linux / WSL2 en Windows).

```bash
cd Tune
cp .env.example .env   # solo la primera vez
make app-up            # construye y levanta
```

| Qué | Dónde |
|---|---|
| Web | http://localhost:8080 |
| API (Swagger) | http://localhost:8000/docs |
| Logs | `make app-logs` |
| Apagar | `make app-down` |

En Windows PowerShell hace falta GNU Make (por ejemplo `winget install ezwinports.make`) y Git Bash instalado: el Makefile usa bash para las recetas.

La primera inferencia de inundación descarga ~1,2 GB de pesos desde Hugging Face. Quedan en caché Docker; las siguientes corridas son mucho más rápidas.

## 3. Cómo usar la web

### Analizar

1. Elige la tarea (**Inundación** o cicatriz).
2. Opciones:
   - **Escena oficial**: India, España, EE. UU. (inundación) o tiles de California (cicatriz).
   - **Tu GeoTIFF**: 6 bandas Prithvi o Sentinel-2 L1C, hasta 200 MB.
   - **Encontrar**: busca por latitud/longitud en el catálogo Sentinel-2 y analiza un recorte.
3. Espera el progreso:
   - Escena oficial: **% real** de descarga del GeoTIFF, tiempo transcurrido y ETA; luego fase de análisis.
   - Subida propia: % de subida y luego análisis.
4. Lee el **Resultado** a la izquierda y el mapa a la derecha.

### Leer el mapa (pestañas)

| Pestaña | Qué muestra |
|---|---|
| **Satélite** | RGB de la escena con la máscara del modelo encima |
| **Agua** | Solo la clasificación del modelo (toda el agua detectada) |
| **Cambio** | Rojo = nueva (inundación), azul = permanente, gris = retirada |
| **Acuerdo** | Coincidencia con GFM u otro producto externo (si hubo dato) |

Si en **Cambio** solo ves rojo y en el panel «agua detectada» ≈ «agua nueva», es esperable: la referencia permanente no encontró cauces estables en esa caja, así que toda el agua del modelo cuenta como nueva. Usa la pestaña **Agua** para ver la máscara completa.

### Historial del lugar

Bloque bajo el mapa. Agrupa **otras corridas** con las mismas coordenadas. No filtra la máscara actual: sirve para comparar fechas cuando hay más de un análisis. Con una sola corrida solo explica eso.

### Resultado (panel izquierdo)

- Cifra grande: **inundación (agua nueva)** cuando hay capa de cambio.
- «Qué midió el modelo»: toda el agua detectada.
- «Inundación frente a referencia»: nueva / permanente / retirada.
- Acuerdo y exposición aparecen si los proveedores respondieron.

## 4. Escenas oficiales: por qué 2 MB tardan minutos

El tamaño que ves (~2,1 MB) es solo el GeoTIFF. El tiempo largo casi siempre es:

1. Primera descarga de pesos del modelo (~1,2 GB), o
2. Inferencia en CPU sobre ventanas 512×512.

La UI muestra el % de la **imagen** en tiempo real. El análisis posterior no tiene % fijo; muestra segundos/minutos transcurridos y una estimación.

Cuando la escena ya está en caché (`Lista`), solo corre el modelo.

## 5. Cómo probar sin la demo visual

```bash
# Pruebas automáticas (sin GPU ni red)
pytest -m "not gpu"

# API ya levantada: escena oficial
curl -X POST "http://localhost:8000/api/examples/usa/analyze"

# Con progreso NDJSON (como la web)
curl -N -X POST "http://localhost:8000/api/examples/usa/analyze?stream=true"
```

Validación multi-sitio (pesos reales, más lenta): ver `docs/validation/sitios.md` y `make validate-sites` si está disponible en el Makefile técnico.

## 6. Mapa de documentación

| Documento | Para qué |
|---|---|
| [Instalación.md](./Instalación.md) | Requisitos y comandos diarios |
| [Desarrollo.md](./Desarrollo.md) | Código, tests, estructura |
| [architecture/v2.md](./architecture/v2.md) | Arquitectura hexagonal |
| [SegundoInforme.md](./SegundoInforme.md) | Avance académico |
| [decisions/](./decisions/) | Decisiones de diseño (ADRs) |
| [validation/](./validation/) | Protocolo de sitios y JRC |

## 7. Glosario corto

| Término | Significado |
|---|---|
| Agua detectada | Salida del modelo (clase agua) |
| Agua permanente (P) | JRC o historial del lugar |
| Agua nueva / inundación | \(W \land \lnot P\) |
| GFM | Copernicus Global Flood Monitoring |
| Checkpoint | Pesos publicados en Hugging Face, sin reentrenar |
