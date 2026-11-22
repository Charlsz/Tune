# Tune: análisis satelital de inundación como cambio hídrico con Prithvi-EO 2.0

Autores: Carlos Andrés Galvis Pájaro y Zenen Contreras Royero.  
Informe final, noviembre de 2026. Repositorio: https://github.com/Charlsz/Tune.

## Resumen / Abstract

Tune distingue el agua permanente de la inundación. El operador busca un nombre, pega coordenadas, marca un rectángulo o sube un GeoTIFF de seis bandas. Sobre esa escena, o sobre las escenas Sentinel-2 de dos fechas, el checkpoint `ibm-nasa-geospatial/Prithvi-EO-2.0-300M-TL-Sen1Floods11` clasifica agua. La inundación es el agua nueva frente a la escena anterior del mismo lugar o, si no hay historia, frente a Global Surface Water del Joint Research Centre (JRC). Cuando Copernicus Global Flood Monitoring (GFM) cubre esa zona y fecha, Tune calcula el acuerdo (Intersection over Union, IoU).

La aplicación es cliente-servidor (FastAPI y MapApp en React/Leaflet) y se despliega con Docker Compose. La medición de inundación en sitios específicos se demostró con tres casos de prueba: en Sindh (Pakistán), entre mayo y septiembre de 2022, el agua pasó de 10,34 km² a 60,22 km² y la inundación fue 49,56 km²; en el Bajo Magdalena la inundación fue 38,25 km²; y en el Mississippi, 10,26 km² sobre un río que ya ocupaba 65,85 km². El acuerdo con GFM fue 0,20 en el pico de Sindh y 0,32 en el pico del Mississippi.

---

## 1. Introducción

Los foundation models geoespaciales desplazaron parte del trabajo práctico desde el preentrenamiento hacia el uso de pesos ya especializados. Prithvi-EO 2.0 y el checkpoint Sen1Floods11 de IBM–National Aeronautics and Space Administration (NASA) detectan agua sobre escenas ópticas. Tune cubre ese vacío: a partir de un lugar y dos fechas, o de un GeoTIFF ya preparado, respeta el procedimiento oficial de inferencia y deja un resultado interpretado y recuperable, sin presentar el cauce permanente como inundación.

El planteamiento inicial era un laboratorio de Machine Learning Operations (MLOps) de fine-tuning. La orientación del curso y la viabilidad técnica nos llevaron a fijar tarea, dataset de procedencia, modelo y criterios verificables en una aplicación de análisis. Tune materializa esa orientación: inundación como cambio hídrico, entrada por lugar, coordenada, rectángulo o GeoTIFF, y acuerdo con GFM (Global Flood Monitoring) cuando hay dato.

## 2. Marco conceptual

### 2.1 Raster, bandas Prithvi y segmentación

Una imagen operativa es un raster georreferenciado. Prithvi-EO 2.0 espera seis bandas (azul, verde, rojo, Near-Infrared (NIR) estrecho, Short-Wave Infrared 1 (SWIR1), Short-Wave Infrared 2 (SWIR2)). Esas bandas llegan de dos maneras: la escena Sentinel-2 del lugar elegido, o un GeoTIFF que el operador sube ya con esas seis bandas. Un archivo que no es GeoTIFF, o que no trae las bandas, no se analiza. La segmentación asigna clase por píxel; el área en km² se obtiene del tamaño de píxel por el conteo positivo, excluyendo nodata.

### 2.2 Foundation model y checkpoint

Tune consume, sin reentrenar, el checkpoint Sen1Floods11. La inferencia oficial recorta ventanas 512×512 y recompone la máscara (TerraTorch). El identificador del modelo viaja en cada análisis. El directorio `lab/` conserva material de fine-tuning fuera del núcleo evaluado.

### 2.3 Cambio hídrico, fusión y exposición

**Agua detectada** es la máscara del modelo. **Inundación** es el agua que no pertenece a la referencia (la escena anterior del mismo lugar, o el agua permanente del JRC (Joint Research Centre) cuando occurrence es al menos 75 %). **Acuerdo** alinea GFM (ensemble flood extent, SpatioTemporal Asset Catalog (STAC) del Earth Observation Data Centre (EODC), ventana de ±10 días) a la grilla del análisis y calcula el IoU (Intersection over Union). La cobertura del suelo (WorldCover) describe sobre qué cae el agua nueva.

## 3. Planteamiento del problema

### 3.1 Descripción del problema

Disponer del modelo y del dataset no basta si el resultado no distingue cauce de desborde ni puede consultarse después. Scripts aislados producen máscaras sin contrato; laboratorios de entrenamiento no entregan análisis si la GPU (Graphics Processing Unit) no cierra. Quienes necesitan una lectura defendible de inundación carecen de un sistema integrado, portable y acotado.

### 3.2 Restricciones y supuestos de diseño

Prototipo académico (sin multi-tenancy, Open Authorization (OAuth) ni Service Level Agreement (SLA)). Un análisis a la vez en Central Processing Unit (CPU) tras cachear pesos. Datasets y productos públicos. Sin preentrenamiento de foundation models. Sin pronóstico hidrológico ni profundidad del agua. GFM y WorldCover pueden fallar sin tumbar el análisis.

### 3.3 Alcance

**Incluye:** búsqueda por lugar, coordenadas o rectángulo; subida de un GeoTIFF de seis bandas (pestaña dedicada `/geotiff` o desde el paso Área del mapa); escenas Sentinel-2; inferencia Prithvi de agua; cambio frente al historial o al JRC; acuerdo con GFM; cobertura del suelo; Application Programming Interface (API); MapApp (área, fechas, escenas, Antes/Después/Cambio/Acuerdo); Docker; medición de inundación en sitios específicos, demostrada con casos de prueba (Sindh, Bajo Magdalena y Mississippi). Cicatriz de incendio como tarea auxiliar.

**Excluye:** reentrenamiento como entregable, autenticación, colas, PostGIS (extensión espacial de PostgreSQL), anclar el producto a un solo territorio, la SPA anterior con router (sustituida por MapApp).

## 4. Objetivos

**General.** Desarrollar un sistema de análisis satelital que distinga la inundación (agua nueva) del agua permanente a partir del checkpoint Sen1Floods11 de Prithvi-EO 2.0, sobre escenas Sentinel-2 o GeoTIFF localizados por el operador, y registre el acuerdo con GFM cuando exista capa.

**Específicos.** (1) Integrar el checkpoint Sen1Floods11 con TerraTorch, sin reentrenamiento, sobre entrada Sentinel-2 o GeoTIFF válido. (2) Calcular agua detectada, agua nueva e inundación en km² frente al historial del sitio o al JRC. (3) Registrar el acuerdo (IoU) con GFM cuando haya cobertura. (4) Exponer el análisis mediante API y MapApp (Antes, Después, Cambio y Acuerdo). (5) Validar la medición de inundación en sitios específicos elegidos por el operador.

## 5. Estado del arte / soluciones relacionadas

Prithvi-EO 2.0 (Szwarcman et al., 2024) y Sen1Floods11 (Bonafilia et al., 2020) fijan el detector. Global Surface Water (GSW) del JRC (Pekel et al., 2016) aporta permanente. Copernicus GFM, Observational Products for End-Users from Remote Sensing Analysis (OPERA) Dynamic Surface Water Extent (DSWx), Flood Hub y prácticas de United Nations Platform for Space-based Information for Disaster Management and Emergency Response (UN-SPIDER) cubren fragmentos operativos. Tune no los sustituye. Aplica el checkpoint como agua detectada, separa la inundación con la referencia permanente y la confronta con el radar cuando hay dato, en cualquier coordenada que el operador marque.

## 6. Solución propuesta

Tune analiza la inundación con dos entradas. En el mapa, el operador busca un lugar, pega coordenadas o dibuja el rectángulo, elige dos fechas y las escenas Sentinel-2. Si ya tiene la imagen preparada, usa la pestaña **GeoTIFF** (`/geotiff`) para cargar uno o dos archivos de seis bandas sin dibujar AOI; el mismo análisis corre sobre ese archivo. Si el raster trae georreferencia, se puede ubicar en el mapa. MapApp muestra la máscara, el cambio (rojo = inundación, azul = agua que ya estaba) y el acuerdo con GFM cuando hay capa. El valor frente a un script suelto es esa lectura, guardada y repetible.

## 7. Metodología de desarrollo

Prototipado iterativo: cada ciclo dejó contrato, puerto, prueba o Architecture Decision Record (ADR). Iteraciones visibles en git: laboratorio hexagonal → app de inferencia (ADR 005) → cambio hídrico (ADR 010) → catálogo, fusión (ADR 014), exposición (ADR 015) → MapApp y validación con casos de prueba multi-sitio. La validación continua usa pytest y vitest en integración continua, y los tres sitios de demostración de la sección 13 se midieron con los pesos publicados.

## 8. Requerimientos

### 8.1 Funcionales

- Listar tarea inundación con id Hugging Face.
- Buscar un lugar por nombre, coordenadas o rectángulo dibujado, y listar escenas Sentinel-2 de dos fechas.
- Aceptar un GeoTIFF de seis bandas Prithvi (pestaña GeoTIFF o desde Área) y rechazar un archivo que no lo sea, o que supere el tamaño máximo.
- Persistir el análisis con máscara, áreas, sistema de referencia y el identificador del modelo.
- Incluir agua nueva, permanente y retirada cuando hay referencia, y el acuerdo cuando GFM responde.
- MapApp: pestañas Mapa, GeoTIFF, Resultados e Historial; modos Antes, Después, Cambio y Acuerdo, con las áreas en km².
- No publicar un acuerdo si GFM no cubre la zona y la fecha. El recorte que supera el máximo no se analiza.

### 8.2 No funcionales

Docker Compose; pesos en volumen; CPU; dominio sin torch/rasterio; un análisis a la vez; sin autenticación; degradación parcial; suite automática sin red ni GPU.

## 9. Evaluación de alternativas

Se consideraron cuatro caminos bajo la carga de un operador y un análisis: (1) fine-tuning propio como núcleo, (2) solo cambiar el dataset y seguir entrenando, (3) clasificador pequeño en CPU ajeno al dominio satelital de seis bandas, (4) **checkpoints publicados + aplicación de cambio, fusión y exposición** (seleccionada).

El primero no entrega análisis si la corrida no cierra. El segundo mejora la pertinencia de los datos y conserva la dependencia de GPU. El tercero es rápido y no resuelve georreferencia, catálogo ni referencia permanente. El cuarto compromete tarea, dataset y modelo, corre en CPU tras cachear pesos y entrega agua nueva, acuerdo y exposición cuando los proveedores responden. El laboratorio de entrenamiento permanece como anexo; el entregable demostrable es la aplicación de análisis.

**Desempeño bajo carga esperada.** La operación crítica es el análisis por API o desde catálogo. Las alternativas de entrenamiento no sirven inferencia si el entrenamiento no terminó. El clasificador pequeño responde rápido a otro problema. En la opción seleccionada la latencia la dominan la primera descarga de pesos y las ventanas 512×512; JRC, GFM y WorldCover leen ventanas remotas, no tiles completos. Se acepta un análisis a la vez, con el modelo cacheado en proceso. El criterio decisivo es el tiempo hasta un análisis visible con agua nueva cuando la referencia responde: la opción 4 produce resultado demostrable en el calendario del curso.

**Acoplamiento.** La opción seleccionada depende de Hugging Face, TerraTorch, JRC, Earth Search, GFM y, si se enciende, Earthdata; cada dependencia queda detrás de un puerto, así que un fallo externo no tumba el resto del análisis. El acoplamiento interno es bajo: en pruebas, dobles sustituyen los adaptadores reales. El camino de entrenamiento acopla el entregable al hardware y al tiempo de corrida; el clasificador pequeño abandona el dominio satelital. Sustituir el frontend o el repositorio en disco no exige tocar Prithvi; sustituir Prithvi exige respetar el puerto y el contrato de seis bandas. La frontera hexagonal limita el radio de cambio.

**Disponibilidad y tolerancia a fallos.** Ninguna alternativa ofrece disponibilidad contractual: el prototipo corre en local mientras Docker está levantado. En la opción seleccionada, si Hugging Face no responde en la primera corrida no hay inferencia nueva y el historial previo sigue; si JRC o GFM fallan, el análisis se guarda sin cambio o sin fusión; si WorldCover falla, sin exposición. Entradas inválidas se rechazan con códigos HTTP explícitos. En el camino de entrenamiento, un fallo de memoria o de corrida deja cero producto de análisis. Por eso se selecciona la opción 4: análisis verificable con las tres lecturas y degradación parcial acotada a la capa que falló.

## 10. Diseño y arquitectura

### 10.1 Arquitectura

Cliente-servidor en dos contenedores (nginx + FastAPI). Enfoque hexagonal: dependencias hacia el dominio; TerraTorch, STAC y rasterio en infraestructura.

#### 10.1.1 Descripción general

Un solo `AnalyzeUseCase` sirve API y MapApp. Inferencia en proceso (sin cola). Persistencia en `artifacts/analyses/<id>/`.

#### 10.1.2 Componentes e interacción

| Componente | Responsabilidad |
|---|---|
| MapApp | Flujo área→fechas→escenas; pestaña GeoTIFF; overlays; métricas; historial de sesión |
| eo-api | Validación Hypertext Transfer Protocol (HTTP), catálogo, orquestación |
| PrithviSegmenter | Ventanas 512×512, máscara |
| ReferenceProvider | Historial antes que JRC (Joint Research Centre) |
| ObservationProvider | GFM (Global Flood Monitoring); OPERA (Observational Products for End-Users from Remote Sensing Analysis) opcional |
| ExposureProvider | Cobertura del suelo (WorldCover) sobre el agua nueva |
| AnalysisRepository | JSON + PNG/TIF |

Fuentes editables: [arquitectura](./assets/diagramas/arquitectura.md), [interacción](./assets/diagramas/interaccion-modulos.md), [secuencias](./assets/diagramas/secuencia-analisis.md), [despliegue](./assets/diagramas/despliegue.md).

**Figura 1. Arquitectura de Tune.** Cliente, API, caso de uso, proveedores externos y disco. No describe módulos internos ni el nodo Docker.

```mermaid
flowchart TB
  subgraph Cliente
    U[Operador]
    W["MapApp :8080"]
  end
  subgraph API["eo-api :8000"]
    HTTP["FastAPI /api"]
    UC["AnalyzeUseCase"]
  end
  subgraph Externos
    HF[Hugging Face]
    ES[Earth Search]
    JRC[JRC GSW]
    GFM[EODC GFM]
    WC[WorldCover]
  end
  ART["artifacts/"]
  U --> W
  W -->|"HTTP /api"| HTTP
  HTTP --> UC
  UC --> HF
  UC --> ES
  UC --> JRC
  UC --> GFM
  UC --> WC
  UC --> ART
```

**Figura 2. Interacción entre módulos.** Abre el backend en capas hexagonal. Las dependencias apuntan al dominio; TerraTorch, STAC y rasterio quedan en infraestructura.

```mermaid
flowchart LR
  subgraph interfaces
    WEB[MapApp]
    API[analyses router]
  end
  subgraph application
    AN[analyze]
    CH[change]
    FU[fusion]
    EX[exposure]
  end
  subgraph domain
    PORTS[Puertos]
  end
  subgraph infrastructure
    PR[prithvi]
    JRC[historial / JRC]
    OBS[GFM]
    WC[WorldCover]
    FS[filesystem]
  end
  WEB --> API --> AN
  AN --> CH
  AN --> FU
  AN --> EX
  AN --> PORTS
  PR -.-> PORTS
  JRC -.-> PORTS
  OBS -.-> PORTS
  WC -.-> PORTS
  FS -.-> PORTS
```

#### 10.1.3 Comportamiento

El paso lento es la inferencia de la escena. La primera vez, la aplicación descarga los pesos (del orden de 1,2 GB) y los deja en caché. Si GFM no cubre la fecha, el análisis se guarda igual y el acuerdo queda vacío. Si no hay escena en esas fechas, o el rectángulo supera el máximo, no se produce un resultado.

**Figura 3. Secuencia del par Antes/Después.** La segunda escena usa la máscara anterior como `history_baseline`. GFM se consulta después de segmentar.

```mermaid
sequenceDiagram
  actor Op as Operador
  participant UI as MapApp
  participant API as eo-api
  participant UC as AnalyzeUseCase
  participant P as Prithvi
  participant R as Historial/JRC
  participant G as GFM
  Op->>UI: Área y dos fechas
  UI->>API: POST analyze Antes
  API->>UC: execute
  UC->>P: segment
  UC->>R: reference
  R-->>UC: JRC
  UC->>G: observe
  API-->>UI: análisis base
  UI->>API: POST analyze Después
  UC->>R: reference
  R-->>UC: history_baseline
  API-->>UI: agua nueva y IoU si hay capa
```

**Figura 4. Secuencia cuando la entrada no llega a análisis.** La búsqueda sin escena, un rectángulo demasiado grande, un archivo que no es GeoTIFF de seis bandas o un modelo no disponible no guardan un resultado.

```mermaid
sequenceDiagram
  actor Op as Operador
  participant UI as MapApp
  participant API as eo-api
  alt busca un lugar
    Op->>UI: Lugar, coordenadas o rectángulo
    UI->>API: Buscar escenas
    alt sin escenas
      API-->>UI: lista vacía
    else área mayor que el máximo
      API-->>UI: 422
    end
  else sube un archivo
    Op->>API: GeoTIFF
    alt no es GeoTIFF de seis bandas
      API-->>Op: 400 o 422
    else supera el tamaño
      API-->>Op: 413
    end
  end
```

**Figura 5. Secuencia del acuerdo con GFM.** Si la capa cubre la grilla, el análisis guarda el IoU. Si no la cubre, el agua nueva se conserva y el acuerdo queda vacío.

```mermaid
sequenceDiagram
  participant UC as AnalyzeUseCase
  participant G as GFM
  participant D as artifacts/
  UC->>G: observe ±10 días
  alt compared_pixels mayor que 0
    G-->>UC: capa alineada
    UC->>D: fusion con IoU
  else sin solape
    G-->>UC: vacío o todo desconocido
    UC->>D: análisis sin IoU
  end
```

## 11. Implementación

### 11.1 Stack tecnológico

Python 3.11, FastAPI, TerraTorch/PyTorch, rasterio, pystac-client; TypeScript, React 19, Vite, Leaflet, Mapbox tiles; Docker Compose; pytest, vitest, ruff.

### 11.2 Componentes

Implementamos el dominio de observación, el análisis, el cambio y el acuerdo, los adaptadores de Prithvi, JRC, historial, GFM, WorldCover y el catálogo STAC, la API y MapApp. El acuerdo se ve cuando hay capa. La aplicación corre en Docker sobre CPU. La SPA anterior con router quedó fuera del árbol activo: MapApp es la única interfaz montada. El laboratorio de entrenamiento quedó en `lab/`, fuera de Tune.

### 11.3 Integraciones

Hugging Face (pesos), Earth Search (escenas del lugar marcado), Global Surface Water del JRC, GFM a través de EODC y WorldCover. OPERA queda opcional y apagado. El token de Mapbox solo sirve al mapa base.

## 12. Despliegue y operación

```bash
cp .env.example .env
make app-up    # o: docker compose up -d --build
```

| Servicio | Uniform Resource Locator (URL) |
|---|---|
| MapApp | http://localhost:8080 |
| API / Swagger | http://localhost:8000/docs |

Volumen `hf-cache` y carpeta `artifacts/` persisten pesos y análisis. Detalle: [Instalación.md](./Instalación.md).

**Figura 6. Despliegue local.** Dos contenedores en el host, volumen de pesos y salida hacia los catálogos. MapApp queda en el puerto 8080 y la API en el 8000.

```mermaid
flowchart TB
  Op[Navegador] -->|"localhost:8080"| WEB[tune-web nginx]
  WEB -->|"proxy /api"| API[tune-eo-api :8000]
  API --- HF[("volumen hf-cache")]
  API --- ART[("bind ./artifacts")]
  API --> NET["HF, Earth Search, JRC, EODC, WorldCover"]
```

## 13. Validación

La validación de Tune combina la suite automática del repositorio con la lectura de sitios específicos. Sindh, el Bajo Magdalena y el Mississippi se usaron como casos de prueba de la medición de inundación en km². Las pruebas de dominio cubren el cálculo de agua nueva y el acuerdo, y corren en integración continua sin GPU. El registro de noviembre de 2026 cuenta **158** pruebas de backend (`pytest -m "not gpu"`) y **36** de la interfaz (`vitest`). Lo que sostiene las conclusiones son los kilómetros cuadrados medidos en esas pruebas.

### 13.1 Pruebas por componentes

Las pruebas unitarias revisan el cambio hídrico, el IoU y la cobertura del suelo con datos de control. Confirman que la cuenta es estable. No reemplazan la lectura de un río real.

### 13.2 Pruebas de integración

MapApp busca el lugar, lista las escenas Sentinel-2 de las dos fechas y guarda el análisis: máscara, agua nueva y, cuando GFM cubre la zona, el acuerdo. Como casos de prueba de integración de punta a punta, Sindh, el Bajo Magdalena y el Mississippi recorrieron ese camino. Los valores están en [sitios-resultados.json](./validation/sitios-resultados.json).

### 13.3 Pruebas de usabilidad

El guion de uso cubre los dos caminos de entrada sin autenticación. **Mapa:** abrir la web, buscar un lugar o pegar coordenadas, dibujar el AOI si hace falta, elegir fechas y escenas, lanzar el análisis y leer Antes/Después/Cambio/Acuerdo en Resultados. **GeoTIFF:** abrir la pestaña GeoTIFF (`/geotiff`), subir uno o dos `.tif`/`.tiff` de seis bandas (mismo lugar si son dos), validar bandas, analizar y abrir Resultados; no hace falta dibujar área ni consultar el catálogo. Criterios de aceptación: el operador completa el flujo sin salir de MapApp; un archivo inválido o demasiado grande se rechaza con mensaje claro; tras un análisis correcto se ven las áreas en km². La evidencia de recorrido está en las capturas de [assets/proof/](./assets/proof/) y en la [Guía de uso](./GuiaDeUso.md).

### 13.4 Resultados por territorio

En los tres casos de prueba el recorte mide 12 km de lado. El agua detectada es la máscara del modelo. La inundación es el agua nueva respecto a la fecha anterior del mismo lugar. El agua permanente es la que ya estaba en esa fecha anterior.

| Lugar | Fechas | Agua detectada (km²) | Inundación (km²) | Agua que ya estaba (km²) |
|---|---|---:|---:|---:|
| Sindh, Pakistán | 18 may 2022 → 5 sep 2022 | 10,34 → 60,22 | **49,56** | 10,03 |
| Bajo Magdalena, Colombia | 22 feb 2022 → 8 may 2022 | 21,95 → 55,08 | **38,25** | 16,17 |
| Mississippi, Estados Unidos | 18 sep 2018 → 10 jun 2019 | 72,16 → 76,12 | **10,26** | 65,85 |

**Sindh.** Entre mayo y septiembre de 2022 el agua pasó de 10,34 km² a 60,22 km². La inundación es 49,56 km². El agua que ya estaba en mayo, y sigue en septiembre, es 10,03 km². El desborde es varias veces el cauce de la fecha seca.

![Sindh, septiembre de 2022. Rojo: 49,56 km² de inundación. Azul: agua que ya estaba en mayo.](./assets/proof/pakistan-peak-change.png)

**Bajo Magdalena.** En febrero había 21,95 km² de agua y en mayo 55,08 km². Frente a febrero, la inundación es 38,25 km² y el agua que permanece es 16,17 km². El mapa permanente del JRC, usado solo, marca 0,77 km² en ese humedal y deja 21,18 km² de febrero como si fueran nuevas. Por eso Tune usa la escena anterior del mismo lugar.

![Bajo Magdalena, de febrero a mayo de 2022. La inundación es 38,25 km².](./assets/proof/magdalena-dry-vs-wet.png)

**Mississippi.** El río ya ocupa casi todo el recorte: 72,16 km² en septiembre de 2018 y 76,12 km² en junio de 2019. La inundación es 10,26 km². El agua que ya estaba es 65,85 km². Un cauce grande no se reporta entero como desborde.

![Mississippi, de 2018 a la crecida de 2019. La inundación es 10,26 km² sobre 65,85 km² que ya estaban.](./assets/proof/mississippi-pre-vs-flood.png)

#### Acuerdo con GFM

| Lugar y fecha | Acuerdo (IoU) |
|---|---:|
| Sindh, 5 sep 2022 | 0,20 |
| Mississippi, 10 jun 2019 | 0,32 |
| Mississippi, 18 sep 2018 | 0,00 |
| Bajo Magdalena, febrero y mayo de 2022 | sin capa |
| Sindh, 18 may 2022 | sin capa |

En el pico de Sindh el acuerdo es 0,20: las dos capas coinciden en una parte de la grilla y GFM no cubre el resto, así que la inundación del lugar sigue siendo 49,56 km². En el Mississippi de 2018 el acuerdo es 0,00 porque GFM no marca crecida y Tune sí mide el río. En junio de 2019 el acuerdo sube a 0,32. En el Magdalena no hubo capa comparable; la inundación es el agua nueva.

## 14. Resultados, discusión y conclusiones

Se cumplió el objetivo de distinguir inundación (agua nueva) de agua permanente con un checkpoint publicado, API, MapApp y medición en sitios específicos. Esa medición se demostró con tres casos de prueba (Sindh, Bajo Magdalena y Mississippi), con pesos reales y tabla documentada. Las tres lecturas están implementadas: agua detectada, agua nueva y acuerdo externo. GFM se consulta en cada análisis y se muestra cuando existe capa.

**Limitaciones.** El acuerdo con GFM es condicional: depende de la cobertura, la fecha y el catálogo, y no sustituye al agua nueva. Hay desfase entre la escena óptica y el radar (Synthetic Aperture Radar, SAR). La población expuesta quedó en 0 en los recortes medidos, así que no forma parte del resultado. El historial de MapApp es de la sesión y no lista aún `GET /api/analyses`. No hay autenticación ni escala multi-usuario.

**Conclusión.** Tune demuestra que un checkpoint publicado, interpretado con una referencia permanente y un contraste opcional con GFM, produce una lectura defendible de inundación. Es un prototipo reproducible, distinto de un laboratorio de entrenamiento y de un Geographic Information System (GIS) operativo completo.

## 15. Trabajo futuro

1. Enlazar el historial de MapApp con los análisis ya guardados.  
2. Avisar, antes de analizar, si GFM tiene capa para esa fecha.  
3. Retirar la interfaz anterior que quedó sin montar.  
4. Publicar la aplicación con HTTPS y el acceso a la API restringido al servidor.  
5. Sumar otros sitios o eventos de prueba en los que GFM sí cubra la grilla, para ampliar la tabla de acuerdo.  
6. Volver a la población afectada solo con un método que no cuente personas únicamente sobre el píxel de agua.

## 16. Referencias

1. Szwarcman, D., et al. (2024). Prithvi-EO-2.0. arXiv:2412.02732.  
2. IBM-NASA Geospatial. Prithvi-EO-2.0-300M-TL-Sen1Floods11. Hugging Face.  
3. Bonafilia, D., et al. (2020). Sen1Floods11. Conference on Computer Vision and Pattern Recognition Workshops (CVPRW).  
4. Pekel, J.-F., et al. (2016). High-resolution mapping of global surface water. Nature.  
5. Wagner, W., et al. The Sentinel-1 Global Flood Monitoring service. Remote Sensing of Environment (RSE).  
6. Copernicus Emergency Management Service (EMS). GFM (Global Flood Monitoring) Product User Manual.  
7. Zanaga, D., et al. (2022). ESA (European Space Agency) WorldCover 2021.  
8. Schiavina, M., et al. (2023). Global Human Settlement Population (GHS-POP) R2023A.  
9. UN-SPIDER (United Nations Platform for Space-based Information for Disaster Management and Emergency Response). Flood mapping recommended practice.  
10. GitHub. Tune. https://github.com/Charlsz/Tune.  
11. Architecture Decision Records (ADRs) del repositorio: `docs/decisions/` (005, 010, 014, 015, 016).  
12. Modelo de repositorio del curso: https://github.com/augustosalazar/pf_modelo_repositorio.
