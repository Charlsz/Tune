# Tune: aplicación de análisis satelital para inundaciones y cicatrices de incendio con Prithvi-EO 2.0

**Avance del segundo informe** · septiembre de 2026 · repositorio [tune](https://github.com/Charlsz/tune)

## Resumen / Abstract

Obtener un mapa de inundación o de cicatriz de incendio a partir de una imagen satelital exige coordinar un raster de varias bandas, un modelo de segmentación, georreferenciación y un servicio que deje el resultado usable. En un prototipo académico, repetir el fine-tuning de un foundation model geoespacial para cada resultado es costoso en tiempo y GPU, difícil de reproducir y frágil de calendario: una corrida bloqueada deja el proyecto sin evidencia. El primer informe planteó Tune como laboratorio MLOps para comparar una estrategia baseline con una optimizada. Esa comparación se implementó como pipeline, pero las corridas largas en la máquina de la universidad no produjeron un experimento cerrado a tiempo.

El proyecto, denominado **Tune**, se redefine como **aplicación de análisis de imágenes satelitales**. El usuario sube un GeoTIFF, elige la tarea (inundación o cicatriz de incendio) y el sistema ejecuta un checkpoint de **Prithvi-EO 2.0** que IBM-NASA ya publicó fine-tuneado en Hugging Face: `Prithvi-EO-2.0-300M-TL-Sen1Floods11` (Sen1Floods11, Sentinel-2) o `Prithvi-EO-2.0-300M-BurnScars` (HLS Burn Scars). Ambos esperan las mismas seis bandas, de modo que un solo pipeline cubre las dos tareas. La salida es una máscara georreferenciada sobre un mapa, con porcentaje y área afectada, historial de análisis, API documentada y despliegue en Docker.

El estado actual es un prototipo funcional: backend FastAPI con TerraTorch, frontend Vite + React + Leaflet, persistencia de artefactos en disco, CLI `tune analyze` y pruebas de API y de estadísticas de máscara. La primera inferencia descarga los pesos (~1,2 GB) y luego corre en CPU; GPU acelera. Quedan pendientes una demo con escenas de ejemplo estables, pulido de usabilidad, y el informe de cierre. El laboratorio de fine-tuning se conserva como componente secundario (rama `backup/mlops-finetuning-lab`); no es lo que se demuestra como resultado principal.

---

## 1. Introducción

El desarrollo de modelos fundacionales para observación de la Tierra ha desplazado una parte del esfuerzo práctico desde el entrenamiento masivo hacia el **uso** de modelos ya especializados. En investigación y en formación en ingeniería de sistemas, el software que rodea al modelo —ingesta del raster, inferencia, georreferencia, API y visualización— es lo que convierte un checkpoint publicado en un análisis que alguien puede inspeccionar. Tendencias como Prithvi-EO 2.0, TerraTorch y los repositorios de Hugging Face de IBM-NASA reflejan esa transición: existen pesos fine-tuneados para inundación y para cicatriz de incendio, y el trabajo de ingeniería es integrarlos de forma reproducible.

En la situación actual, quienes necesitan un mapa de agua o de área quemada a partir de Sentinel-2 o HLS suelen enfrentarse a un mercado polarizado. En un extremo están plataformas cloud y flujos de fine-tuning propios, capaces de adaptar un foundation model, pero con costo, duración y dependencia de GPU desproporcionados para un equipo académico con plazo fijo. En el otro, notebooks y scripts de inferencia aislados producen una máscara, pero rara vez dejan historial, API, mapa ni un despliegue repetible. El impacto recae sobre estudiantes e ingenieros que, para “tener un resultado”, se ven obligados a esperar corridas de entrenamiento que pueden no terminar.

La necesidad técnica identificada no es la ausencia de un modelo. Existen Prithvi-EO 2.0, Sen1Floods11, HLS Burn Scars y TerraTorch. Lo que falta con frecuencia, al alcance de un prototipo de grado, es una **aplicación acotada** que reciba un GeoTIFF, ejecute el checkpoint publicado de la tarea elegida y devuelva una máscara ubicable en un mapa, con métricas de área y un registro recuperable. Esa carencia abre una oportunidad de diseño: un sistema pequeño, defendible y demostrable, que separe la infraestructura de análisis (qué entra, qué sale, cómo se sirve) del entrenamiento del foundation model (que ya ocurrió y está publicado).

A partir de esta oportunidad se propone **Tune**, un prototipo de aplicación de análisis satelital. Sus funcionalidades clave son la selección de tarea, la inferencia con ventana deslizante sobre el checkpoint IBM-NASA correspondiente, el cálculo de porcentaje y km² afectados, el mapa con overlay, el historial y el despliegue en Docker. El impacto esperado es disponer de un flujo verificable —imagen entra, análisis sale— sin depender de una corrida de fine-tuning de varios días en GPU para cada demostración.

El estado del trabajo, a la fecha de este avance, es el de un sistema ya cableado de extremo a extremo en código (API, web, persistencia, Docker) y validado con pruebas automáticas del flujo de análisis (sin cargar PyTorch en CI). La demostración con pesos reales y una escena de ejemplo es el hito inmediato hacia la entrega.

---

## 2. Marco conceptual

### 2.1 Observación de la Tierra, raster y segmentación semántica

Una imagen satelital operativa no es una fotografía RGB. Es un **raster** georreferenciado: una o más bandas espectrales alineadas a una grilla, con un sistema de coordenadas (CRS) y una transformación que relaciona píxel y terreno. Sentinel-2 aporta, entre otras, las bandas visibles, el infrarrojo cercano estrecho (8A) y los SWIR (11 y 12). HLS (Harmonized Landsat and Sentinel-2) ofrece una serie armonizada a 30 m. Prithvi-EO 2.0, el modelo que consume Tune, no lee las trece bandas de un producto L1C: espera **seis** —BLUE, GREEN, RED, NIR_NARROW, SWIR_1, SWIR_2—. Esa convención es el contrato de entrada del sistema.

La **segmentación semántica** asigna una clase a cada píxel. En inundación, las clases del checkpoint publicado son “sin agua” y “agua / inundación”. En cicatriz de incendio, “no quemado” y “cicatriz”. El resultado es una **máscara**: una matriz de enteros del mismo tamaño que la escena. Si el raster tiene CRS, esa máscara puede reproyectarse a una caja en EPSG:4326 y dibujarse sobre un mapa web. Si no tiene CRS, la máscara sigue siendo un arreglo de clases, pero no hay dónde ubicarla geográficamente. El área en km² se obtiene del tamaño de píxel (metros si el CRS es proyectado; aproximación por latitud media si es geográfico) multiplicado por el recuento de píxeles de la clase positiva, excluyendo nodata.

Este marco fija tres consecuencias de diseño. Primera: Tune no “detecta inundación en cualquier JPG”. Acepta GeoTIFF con las seis bandas Prithvi o, en la tarea de inundación, un Sentinel-2 L1C completo del que se extraen los índices 2, 3, 4, 8A, 11 y 12 (0-based: 1, 2, 3, 8, 11, 12). Segunda: el porcentaje afectado se calcula solo sobre píxeles válidos, no sobre el recorte entero. Tercera: el mapa es un visor de un resultado georreferenciado, no un GIS de propósito general.

### 2.2 Foundation models geoespaciales y checkpoints publicados

Un **foundation model** de observación de la Tierra aprende representaciones sobre grandes volúmenes de series temporales satelitales y se especializa después en una tarea etiquetada. **Prithvi-EO 2.0** (IBM-NASA) es un modelo de ese tipo, con variantes de 300 M de parámetros, entrenado sobre series HLS y publicado junto con configuraciones de fine-tuning para tareas de desastre. El fine-tuning consiste en continuar el entrenamiento sobre un dataset de la tarea (por ejemplo Sen1Floods11 o HLS Burn Scars) hasta obtener un **checkpoint**: un archivo de pesos más un `config.yaml` que describe bandas, tamaño de parche y cabezal de segmentación.

IBM-NASA publicó en Hugging Face, ya fine-tuneados, dos checkpoints que Tune consume de forma directa:

| Tarea en Tune | Dataset de especialización | Repositorio Hugging Face | Entrada |
|---|---|---|---|
| Inundación (`flood`) | Sen1Floods11 (eventos de inundación; el checkpoint usa óptico Sentinel-2) | `ibm-nasa-geospatial/Prithvi-EO-2.0-300M-TL-Sen1Floods11` | 6 bandas Prithvi, o L1C amplio |
| Cicatriz de incendio (`burn_scar`) | HLS Burn Scars (escenas 2018–2021, EE. UU. contiguo) | `ibm-nasa-geospatial/Prithvi-EO-2.0-300M-BurnScars` | 6 bandas Prithvi |

**Sen1Floods11** es un conjunto georreferenciado de chips de inundación publicado para entrenar y evaluar algoritmos de agua superficial; el checkpoint de Prithvi que se usa aquí se especializó sobre la vía óptica Sentinel-2 de ese ecosistema. **HLS Burn Scars** reúne escenas HLS de 512×512 con máscaras de área quemada. En ambos casos el dataset está versionado fuera de Git, en Hugging Face o en el repositorio original del dataset, y Tune no lo reentrena: lo usa como **procedencia** del modelo servido.

La distinción que organiza el proyecto es esta. **Entrenar** un Prithvi-300M sobre esos datasets es un experimento de adaptación: exige GPU, horas de reloj, un protocolo de comparación y umbrales de calidad. **Inferir** con el checkpoint ya publicado es un problema de ingeniería de software: descargar pesos, respetar el preprocesado oficial (reflectancia 0–1, ventana 512×512, coordenadas temporales y de ubicación cuando el modelo las pide) y persistir la máscara. El primer informe se situaba en lo primero. Este segundo informe se sitúa en lo segundo, porque lo primero no produjo un resultado demostrable en el plazo y porque lo segundo sí compromete tarea, dataset y modelo de forma verificable.

### 2.3 Inferencia por ventana deslizante, MLOps acotado y servicio

Los checkpoints oficiales de Prithvi documentan un `inference.py` que no pasa la escena entera por la red: recorta **ventanas de 512×512** con solapamiento de padding reflectante, infiere cada parche y recompone la máscara. Tune porta esa lógica a través de TerraTorch (`LightningInferenceModel.from_config`) para no divergir del procedimiento publicado. El dispositivo puede ser CPU o CUDA; la semántica de la máscara no cambia.

Alrededor de esa inferencia hay prácticas de **MLOps** en sentido acotado: versionar el modelo que se está usando (el `repo_id` de Hugging Face viaja en cada análisis), registrar artefactos (GeoTIFF de entrada, máscara PNG y GeoTIFF, preview RGB, JSON de metadatos) y exponer el resultado por **API** y por **CLI**. Eso no es un laboratorio de comparación de LoRA contra full fine-tuning. Es el cierre de ciclo que el primer informe ya pedía —el modelo no queda como archivo suelto— aplicado ahora a un checkpoint ajeno y publicado.

La **arquitectura hexagonal** (puertos y adaptadores) separa el dominio —tarea de peligro, análisis, estadísticas— de TerraTorch, rasterio y FastAPI. El segmentador es un puerto (`HazardSegmenter`); la persistencia es otro (`AnalysisRepository`). Esa separación es el concepto que permite cambiar de checkpoint sin reescribir la interfaz, y el que permite probar la API con un segmentador falso, sin GPU y sin descargar 1,2 GB de pesos.

En conjunto, el marco conceptual del segundo informe es: raster de seis bandas → foundation model ya especializado → máscara georreferenciada → sistema que la sirve. Fine-tuning, PEFT y GPU-hours siguen existiendo como vocabulario del componente secundario y como explicación de por qué no se reentrena; no son la métrica de éxito de la aplicación.

---

## 3. Planteamiento del problema

### 3.1 Descripción del problema

Producir un análisis de inundación o de cicatriz de incendio a partir de una escena satelital implica coordinar un GeoTIFF de varias bandas, un modelo de segmentación, georreferencia y un modo de consultar el resultado. En equipos académicos de alcance limitado, ese proceso suele quedar partido: o se invierte el semestre en fine-tunear el foundation model y no se llega a un producto usable, o se corre un script de inferencia una vez y no queda sistema.

Las causas principales son tres. Primera, el costo y la duración del fine-tuning de un modelo del orden de 300 M de parámetros desalientan iterar y empujan a aceptar “cuando la corrida termine”, si es que termina. Segunda, las herramientas existentes cubren fragmentos (TerraTorch entrena o infiere; Hugging Face aloja pesos; Leaflet dibuja mapas) pero no obligan a un flujo único de subir escena, elegir tarea, persistir máscara y recuperarla. Tercera, depender de la GPU del laboratorio o de una imagen Docker de PyTorch+CUDA de varios gigabytes introduce un punto único de fallo de infraestructura: si la descarga o la cola se bloquean, no hay resultado que mostrar.

La población afectada son estudiantes, ingenieros e investigadores que necesitan un análisis satelital demostrable **sin** una plataforma enterprise y **sin** semanas de GPU dedicada. El estado negativo es un ciclo en el que el modelo fundacional existe, los datasets existen, y aun así no hay una aplicación que, dada una escena válida, devuelva una máscara ubicable y un historial.

El problema puede sintetizarse así:

> **Disponer de un foundation model geoespacial y de datasets de inundación o incendio no produce, por sí solo, un análisis usable. Quienes dependen de reentrenar el modelo para cada resultado quedan expuestos a corridas largas, a fallos de infraestructura GPU y a un quiebre entre el notebook de inferencia y un servicio consultable. Falta un sistema acotado que, con checkpoints ya publicados, transforme un GeoTIFF en una máscara georreferenciada recuperable.**

La problemática no consiste en hacer falta un foundation model nuevo, ni en la inexistencia de SageMaker. Existen Prithvi-EO 2.0 y los dos checkpoints fine-tuneados. La oportunidad es **organizar el uso** de esos modelos en un prototipo de ingeniería verificable.

La retroalimentación del primer informe pedía comprometer tarea, dataset, modelo y un objetivo que se pueda comprobar. Ese pedido se atiende aquí nombrando las dos tareas, los dos datasets de procedencia y los dos repositorios de Hugging Face, y definiendo el resultado como “escena válida → análisis persistido”, no como “tabla de GPU-hours”.

### 3.2 Restricciones y supuestos de diseño

El proyecto está condicionado por las siguientes restricciones y supuestos:

* Carácter académico y de prototipo funcional. No se busca disponibilidad, autenticación ni escala de una plataforma comercial.
* Los pesos de los modelos se descargan de Hugging Face en la primera inferencia (~1,2 GB por checkpoint) y se cachean. Sin red en esa primera corrida, el sistema no infiere.
* La entrada válida es un GeoTIFF con las seis bandas Prithvi o, en inundación, un Sentinel-2 L1C con suficientes bandas. Una escena RGB de tres canales o un recorte sin esas bandas se rechaza.
* Sin CRS, la máscara se calcula y no se ubica en el mapa; el área en km² puede faltar.
* CPU es suficiente para demostrar el flujo; GPU es opcional y acelera. El éxito del prototipo no depende de la máquina de la universidad.
* Un análisis a la vez es la carga esperada de la demo. No hay cola de trabajos ni usuarios concurrentes de producción.
* Datasets y pesos son públicos, con licencias de uso académico de sus publicadores. No se versionan en Git.
* El laboratorio de fine-tuning (baseline versus optimizado) queda fuera del camino crítico. Se conserva en el repositorio como componente secundario.
* No se preentrena un foundation model. No se reentrena Prithvi como requisito de la entrega.
* PostGIS, autenticación, descarga automática desde Copernicus y operación 24/7 quedan fuera de este ciclo.

### 3.3 Alcance actualizado

Respecto del primer informe, el alcance **cambia de eje**. Allí Tune era un laboratorio que ejecutaba dos estrategias de fine-tuning, registraba GPU-hours y promovía un modelo. Aquí Tune es una aplicación que ejecuta dos checkpoints publicados y muestra el análisis.

**Incluye**

* Ingesta de GeoTIFF (hasta 200 MB) y selección de tarea `flood` o `burn_scar`.
* Inferencia con el checkpoint IBM-NASA correspondiente, siguiendo el procedimiento oficial de ventana 512×512.
* Cálculo de píxeles válidos, píxeles afectados, razón y área en km² cuando hay tamaño de píxel.
* Persistencia por análisis: `analysis.json`, `input.tif`, `mask.png`, `preview.png`, `mask.tif`.
* API REST (`GET /api/tasks`, `POST /api/analyze`, historial y descarga de artefactos) y CLI `tune analyze`.
* Interfaz web: carga, mapa Leaflet con overlay, estadísticas e historial.
* Despliegue `docker compose --profile app` (CPU) y perfil GPU opcional.
* Pruebas automáticas del caso de uso y de la API con segmentador inyectado.

**No incluye**

* Fine-tuning propio como entregable principal, ni tabla baseline versus LoRA como evidencia de éxito.
* PostGIS, autenticación, colas, multi-usuario, SLA.
* Descarga automática de escenas Copernicus o un catálogo nacional de inundaciones.
* Reentrenamiento de Prithvi, preentrenamiento, o un tercer dominio (cultivos, deslizamientos, etc.).
* Alta disponibilidad, Kubernetes, facturación.

**Usuarios previstos.** El equipo opera la aplicación y carga escenas de ejemplo. El tutor o el jurado usa la interfaz o la API para ver una máscara y el historial. No hay base de usuarios productivos.

**Resultado esperado.** Prototipo validado de análisis satelital, con dos tareas comprometidas, dos modelos publicados y un flujo demostrable en CPU. El laboratorio de fine-tuning permanece como respaldo, no como condición de cierre.

---

## 4. Objetivos

Los objetivos se formulan como logros verificables y recogen la retroalimentación del primer informe: una tarea (en la práctica dos, con el mismo contrato de entrada), datasets y modelos nombrados, y un resultado que se puede comprobar sin reinterpretar umbrales a posteriori.

### 4.1 Objetivo general

**Diseñar e implementar Tune, un prototipo de aplicación de análisis de imágenes satelitales que, dado un GeoTIFF con las bandas que espera Prithvi-EO 2.0, ejecute el checkpoint publicado de inundación o de cicatriz de incendio, devuelva la máscara georreferenciada con porcentaje y área afectada, y deje el análisis recuperable mediante API, CLI e interfaz de mapa.**

* **Específico:** sistema de ingesta, inferencia, persistencia y visualización; no un detector comercial ni un laboratorio de PEFT.
* **Medible:** existencia de los dos checkpoints cableados, de `POST /api/analyze`, del historial y de la máscara sobre el mapa para una escena de ejemplo.
* **Alcanzable:** CPU para la demo; GPU opcional; un análisis a la vez.
* **Relevante:** responde al quiebre entre modelo publicado y análisis usable, y al riesgo de depender de corridas largas de fine-tuning.
* **Con plazo:** acotado a este ciclo de proyecto de grado.

### 4.2 Objetivos específicos

1. **Fijar** el contrato de entrada (seis bandas Prithvi; L1C amplio solo en inundación) y el de salida (máscara, bounds EPSG:4326, estadísticas, `model_id`).

2. **Integrar** los checkpoints `Prithvi-EO-2.0-300M-TL-Sen1Floods11` y `Prithvi-EO-2.0-300M-BurnScars` mediante TerraTorch, sin reentrenar.

3. **Implementar** el caso de uso de análisis (segmentar, calcular estadísticas, persistir artefactos) compartido por API y CLI.

4. **Exponer** una API documentada que liste tareas, reciba un GeoTIFF, rechace entradas inválidas y sirva historial y archivos.

5. **Construir** una interfaz que permita elegir tarea, subir la escena y ver máscara, porcentaje, km² e historial sobre un mapa.

6. **Empaquetar** el sistema en Docker Compose de modo que una máquina sin NVIDIA pueda demostrar el flujo (tras cachear pesos).

7. **Validar** el prototipo con pruebas del cálculo de estadísticas, de la API y de una inferencia real sobre una escena de ejemplo de Hugging Face.

8. **Documentar** el cambio de alcance respecto del primer informe, las alternativas descartadas y el laboratorio de fine-tuning como componente secundario.

Un enunciado verificable, en la forma que pidió la retroalimentación, es:

> Ejecutar el checkpoint publicado de la tarea elegida sobre un GeoTIFF válido, persistir el análisis con el identificador del modelo y servir la máscara y las estadísticas por la API comprometida; rechazar archivos que no sean GeoTIFF o tareas desconocidas.

---

## 5. Estado del arte / soluciones relacionadas

### 5.1 Prithvi-EO 2.0 y TerraTorch

Prithvi-EO 2.0 es un foundation model geoespacial de IBM-NASA, con pesos y recetas de fine-tuning públicas. TerraTorch es el toolkit con el que esos recetarios se ejecutan. Resuelven el “cómo adaptar o cómo inferir el modelo”. No resuelven, por sí solos, una aplicación con historial, mapa y Docker listo para una demo académica. Tune los usa como motor de inferencia, no como producto.

### 5.2 Datasets de desastre

Sen1Floods11 y HLS Burn Scars son conjuntos de referencia para agua en inundación y para cicatriz de incendio. Permiten entrenar y reportar mIoU. Tune no reporta una nueva cifra de mIoU sobre esos conjuntos en este ciclo: reporta que los modelos **ya evaluados y publicados** por IBM-NASA se pueden consumir en un flujo de ingeniería. El dataset queda como procedencia del checkpoint, que es lo que la retroalimentación pedía nombrar.

### 5.3 Scripts de inferencia, GIS y plataformas cloud

El `inference.py` de cada repositorio Hugging Face produce una máscara en disco. Un GIS de escritorio la visualiza. Una plataforma cloud podría servir el modelo con autenticación y cola. El vacío que aborda Tune es el tramo intermedio: un prototipo único que une inferencia oficial, API, persistencia y mapa, sin pretender ser Copernicus Browser ni SageMaker.

### 5.4 El laboratorio MLOps del primer informe

El planteamiento anterior se posicionaba frente a scripts manuales de fine-tuning, trainers, MLflow y SageMaker, con el núcleo en comparar eficiencia. Ese posicionamiento sigue siendo válido **para el componente secundario**. El posicionamiento de este informe es otro: frente a “reentrenar para tener un mapa” y frente a “correr un script una vez”, Tune ofrece un sistema de análisis con modelos publicados.

| Enfoque | Infiere Prithvi publicado | App con mapa e historial | Reentrena | GPU obligatoria para un resultado |
|---|---:|---:|---:|---:|
| Script `inference.py` oficial | Sí | No | No | No |
| Laboratorio Tune v1 (fine-tuning) | Tras entrenar | Mínima | Sí (núcleo) | Sí |
| GIS de escritorio | Si se importa la máscara | Parcial | No | No |
| Plataforma cloud | Posible | Sí | Opcional | Según el plan |
| **Tune (este informe)** | **Sí (núcleo)** | **Sí** | Secundario | **No** |

---

## 6. Solución propuesta

Tune es una aplicación de análisis satelital de alcance académico. Recibe un **GeoTIFF** y una **tarea** (`flood` o `burn_scar`); ejecuta el checkpoint Prithvi-EO 2.0 publicado para esa tarea; y devuelve una **máscara** con estadísticas, lista para el mapa y para la API.

Los usuarios de la demo cargan una escena de ejemplo (las publicadas junto a cada modelo en Hugging Face) o una escena propia que cumpla el contrato de bandas. El sistema no se presenta como un laboratorio para decidir si LoRA ahorra memoria. El caso de inundación y el de incendio **son el producto visible**. El aporte es el sistema que los hace consultables: mismo pipeline, dos checkpoints.

### 6.1 Enfoque general y propuesta de valor

El enfoque es **consumir especialización ya publicada** en lugar de producirla en el laboratorio. IBM-NASA fine-tuneó Prithvi-EO 2.0-300M sobre Sen1Floods11 y sobre HLS Burn Scars y dejó config + pesos en Hugging Face. Tune descarga esos artefactos, aplica el preprocesado del recetario oficial (selección de bandas, escala a reflectancia, ventana 512×512, coordenadas temporales y de ubicación en inundación) y persiste lo que un usuario puede auditar: la entrada, la máscara, un preview RGB y un JSON con `model_id`, bounds y latencia.

La propuesta de valor, atada al problema, es esta: un análisis de agua o de área quemada **sin** una corrida de fine-tuning de varios días y **sin** quedar atrapado en un notebook. El valor para ingeniería es un contrato estable (bandas, tareas, artefactos) y una arquitectura en la que TerraTorch no contamina el dominio. El valor para un público no técnico es: “sube la escena, elige inundación o incendio, ves el overlay y el porcentaje afectado”.

Lo construido en la fase de laboratorio no se tira. Se reutilizan la arquitectura por capas, FastAPI, Typer, Docker Compose, la imagen con PyTorch y TerraTorch, y la caché de Hugging Face. Lo que deja de ser el centro es el par experimental baseline versus optimized.

### 6.2 Usuarios, flujo y experiencia demostrable

Hay un perfil de operación (el equipo) y un perfil de consulta (tutor, jurado, visitante de la demo). Ambos usan la misma interfaz. No hay roles ni login.

El flujo de funcionamiento es:

```text
GeoTIFF + tarea (flood | burn_scar)
   ↓
Validación (.tif / .tiff, tamaño ≤ 200 MB)
   ↓
Lectura rasterio + selección de 6 bandas
   ↓
Checkpoint HF (caché) + TerraTorch LightningInferenceModel
   ↓
Ventana deslizante 512×512 → máscara
   ↓
Estadísticas (válidos, afectados, %, km²) + bounds EPSG:4326
   ↓
Persistencia artifacts/analyses/<id>/
   ↓
API / CLI / mapa Leaflet
```

La experiencia demostrable es:

1. Abrir `http://localhost:8080` (Compose perfil `app`).
2. Elegir inundación o cicatriz.
3. Subir un GeoTIFF de ejemplo del repositorio del modelo.
4. Ver overlay, porcentaje, km² (si hay CRS) e identificador del modelo.
5. Reabrir el análisis desde el historial.
6. Opcional: repetir lo mismo con `tune analyze` o con `POST /api/analyze`.

La API no entrena. Un consumidor envía el archivo y la tarea y recibe el análisis, o consulta `/api/tasks` y `/api/analyses`. Los artefactos se descargan por `/api/analyses/{id}/{artifact}`.

### 6.3 Relación con el problema, el alcance y la retroalimentación

Esta solución responde al problema porque el resultado deja de depender de que termine un entrenamiento en la GPU de la universidad. Responde al alcance porque nombra dos tareas, dos datasets de procedencia y dos modelos, y porque declara con igual claridad lo que no hace (reentrenar, PostGIS, Copernicus). Responde a la retroalimentación porque el objetivo verificable ya no es un umbral de mIoU entre dos estrategias aún no corridas: es un análisis recuperable con el `model_id` del checkpoint usado.

El laboratorio de fine-tuning permanece en el repositorio (`make lab-experiment` o `make -C lab experiment`, rama `backup/mlops-finetuning-lab`) para quien quiera retomar la pregunta de eficiencia. No forma parte del criterio de éxito de este informe.

---

## 7. Metodología de desarrollo

Se adopta **prototipado iterativo** porque la solución combina raster, modelo, API e interfaz. Construir todo a la vez incrementaba el riesgo de no tener ni máscara ni mapa. Cada ciclo deja un componente funcional o una evidencia (endpoint, test, overlay) y documentación asociada.

Las iteraciones reales del proyecto, una vez incorporado el ajuste de enfoque, son:

1. **Arquitectura y contrato.** Puertos `HazardSegmenter` y `AnalysisRepository`, entidades `Analysis` y `HazardTask`, decisión ADR 005.
2. **Inferencia.** Adaptación del `inference.py` oficial, selección de bandas, caché de modelos por tarea.
3. **API y CLI.** `POST /api/analyze`, historial, artefactos, `tune analyze`.
4. **Web.** Carga, mapa, estadísticas, historial.
5. **Despliegue.** Perfil `app` en Compose, CPU por defecto, GPU opcional.
6. **Validación.** Pruebas unitarias de estadísticas y bandas; integración de API con segmentador falso; inferencia real sobre ejemplo HF (pendiente de dejar documentada como corrida de cierre).
7. **Cierre de informe.** Este documento, alcance actualizado, alternativas.

El hallazgo que forzó el ajuste fue empírico: el flujo `make lab-experiment` no completó una corrida en la máquina de la universidad (descarga bloqueada de la imagen PyTorch+CUDA desde el 17-09). Revisar el código de entrenamiento reveló, además, defectos que habrían invalidado un resultado (dataset no extraído, mIoU siempre 0, VRAM no medida). El prototipado permitió pivotar el núcleo hacia inferencia publicada **sin** reescribir desde cero: las capas y Docker ya existían.

La regla de prioridad, actualizada: primero un análisis demostrable con checkpoint publicado; después pulido de interfaz y de escena colombiana **solo si** el GeoTIFF cumple las seis bandas; el laboratorio de fine-tuning no desplaza esa demo.

---

## 8. Requerimientos

### 8.1 Funcionales

* RF1. El sistema lista las tareas disponibles (`flood`, `burn_scar`) con el identificador Hugging Face del modelo.
* RF2. El usuario carga un GeoTIFF y una tarea. El sistema ejecuta la inferencia y persiste un análisis con identificador único.
* RF3. El análisis incluye recuento de píxeles válidos y afectados, razón, área en km² cuando es calculable, CRS, bounds y latencia.
* RF4. El sistema entrega preview RGB, máscara PNG (overlay) y máscara GeoTIFF.
* RF5. El historial lista análisis recientes y permite recuperar uno y sus artefactos.
* RF6. La API rechaza archivos que no sean `.tif`/`.tiff`, tareas desconocidas y cargas mayores a 200 MB.
* RF7. La CLI `tune analyze` produce el mismo caso de uso que la API.
* RF8. La interfaz muestra la máscara sobre un mapa cuando hay bounds; si no hay CRS, muestra el resultado numérico y el preview.

### 8.2 No funcionales

* RNF1. **Reproducibilidad.** `docker compose --profile app` basta para levantar API y web. Los pesos se cachean en volumen `hf-cache`.
* RNF2. **Portabilidad.** La demo funciona en CPU. GPU es aceleración, no requisito.
* RNF3. **Mantenibilidad.** El dominio no importa torch ni rasterio. TerraTorch se carga de forma perezosa.
* RNF4. **Claridad de fallo.** Falta de extra de entrenamiento, raster con número de bandas incorrecto o modelo no descargable se traducen en error explícito (503 / 422), no en máscara silenciosa.
* RNF5. **Desempeño de demo.** Un análisis a la vez. No se compromete latencia máxima ni throughput de usuarios concurrentes.
* RNF6. **Seguridad.** Prototipo local, sin autenticación. No se expone como servicio público en este ciclo.
* RNF7. **Usabilidad.** La demo se completa en la pantalla principal: carga, espera, mapa, cifras, historial.

---

## 9. Evaluación de alternativas

Las alternativas que se compararon no son un catálogo abstracto de backends. Son las opciones reales del proyecto después del primer informe y después del bloqueo en el laboratorio. Los criterios del template (desempeño bajo carga, acoplamiento, disponibilidad) se aplican a **esa** decisión, con la carga esperada de una demo académica: un operador, un análisis a la vez, demostración en un PC o en un navegador.

### 9.1 Alternativas consideradas

**A1. Mantener el fine-tuning propio como núcleo** (baseline FP32 full fine-tuning versus LoRA+FP16, mismo dataset y mismo Prithvi, umbrales de mIoU 0,60 y caída máxima 0,02). Es el planteamiento del primer informe. Produce evidencia de eficiencia si las dos corridas terminan en el mismo hardware. Exige GPU, horas de reloj e imagen Docker PyTorch+CUDA. Entre el 17 y el 21 de septiembre esa imagen no terminó de descargarse en la máquina de la universidad, y el código de entrenamiento aún contenía errores que habrían anulado la tabla. Sin corrida no hay métrica que defender.

**A2. Cambiar solo el caso de estudio** de HLS Burn Scars a Sen1Floods11 y seguir entrenando. Mejora la pertinencia temática (inundaciones en Colombia) y reutiliza las mismas seis bandas. No elimina la dependencia de GPU ni el riesgo de una corrida que no arranca. El dominio cambia; el cuello de infraestructura no.

**A3. Plan B de clasificación** (ResNet-50 + `beans` o CIFAR-10). Cabe en CPU o en una GPU pequeña y habría permitido el par experimental del primer informe. No produce un análisis geoespacial ni aprovecha Prithvi, TerraTorch ni las escenas satelitales ya exploradas. El resultado demostrable sería una etiqueta de clase, no un mapa de inundación.

**A4. Checkpoints Prithvi-EO 2.0 publicados + aplicación de análisis** (opción seleccionada). Compromete tarea, dataset de procedencia y modelo. La inferencia corre en CPU. El viernes (y este avance) se pueden mostrar máscara, área e historial. El fine-tuning queda como componente secundario, no como condición para tener producto.

### 9.2 ¿Cuál alternativa ofrece mejor desempeño bajo la carga esperada?

La carga esperada es **un** `POST /api/analyze` durante una demo, no un millar de usuarios. En ese régimen, latencia promedio/máxima y throughput concurrente no discriminan A1–A3 de A4: A1 y A2 ni siquiera llegan a servir una inferencia si el entrenamiento no cerró; A3 sirve rápido un problema distinto. A4 tiene una latencia de infencia dominada por (i) la primera descarga de ~1,2 GB de pesos y (ii) el recorrido de ventanas 512×512 sobre la escena. CPU es más lenta y es la que se puede mostrar en cualquier máquina. GPU reduce (ii) y no es requisito.

Comportamiento bajo concurrencia: A4 no está diseñada para ella. Un segundo análisis espera; el modelo se cachea en proceso por tarea. Eso es suficiente para el prototipo y se declara como techo. A1/A2, bajo la misma carga de “un resultado esta semana”, se degradan hasta cero porque el resultado no existe. El criterio de desempeño que sí importa aquí es **tiempo hasta un análisis visible**, no peticiones por segundo.

| Criterio (carga de demo) | A1 Fine-tuning núcleo | A2 Pivot dataset, mismo train | A3 ResNet/CIFAR | A4 App + checkpoints publicados |
|---|---|---|---|---|
| Tiempo hasta un resultado visible | Días, bloqueado en el lab | Igual riesgo de GPU | Horas, otra tarea | Minutos tras cachear pesos |
| Latencia de una inferencia | N/A hasta entrenar | N/A hasta entrenar | Baja | Media en CPU, menor en GPU |
| Throughput concurrente | No aplica | No aplica | Alto e irrelevante | Un análisis a la vez (aceptado) |

### 9.3 ¿Qué grado de acoplamiento introduce cada opción?

A4 depende de **Hugging Face** para config y pesos y de **TerraTorch** para `LightningInferenceModel`. Si el repositorio del checkpoint se mueve o si TerraTorch cambia el CLI, la inferencia se rompe. Ese acoplamiento es deliberado: se replica el procedimiento oficial, no se reimplementa el modelo. El acoplamiento interno es bajo: el dominio habla un puerto; un `FakeSegmenter` sustituye a Prithvi en las pruebas; cambiar de `flood` a `burn_scar` es cambiar de `ModelCard`, no de arquitectura.

A1 y A2 añaden acoplamiento al **hardware del laboratorio** y a una imagen CUDA de varios GB: el pipeline de comparación no sustituye al trainer sin rehacer configs YAML, TerraTorch y la instrumentación de VRAM. A3 reduce el acoplamiento geoespacial (Hugging Face Transformers basta) y aumenta el acoplamiento semántico al plan original (hay que seguir hablando de promoción y umbrales de accuracy), a costa de abandonar el dominio.

Facilidad de sustitución: en A4, sustituir el backend web o el repositorio de análisis (hoy archivos en disco) no exige tocar Prithvi. Sustituir Prithvi por otro segmentador sí exige respetar el puerto y el contrato de seis bandas. PostGIS se dejó fuera precisamente para no acoplar el primer resultado a una base espacial.

### 9.4 ¿Qué nivel de disponibilidad y tolerancia a fallos ofrece cada alternativa?

Ninguna opción es un servicio con uptime comprometido. El prototipo es Compose en una máquina. La pregunta útil es qué pasa cuando **falla un paso**.

En A4, si Hugging Face no responde en la primera corrida, no hay inferencia; los análisis ya persistidos en `artifacts/analyses/` siguen listables. Si TerraTorch falla al cargar el checkpoint, la API responde 503 y el contenedor web permanece. Si un análisis individual lanza `ValueError` (bandas incorrectas), responde 422 y el historial previo no se borra. No hay réplicas ni backup automático; hay artefactos en disco que se pueden copiar.

En A1/A2, un fallo de descarga de imagen Docker o un OOM deja **cero** análisis de producto y, además, cero tabla experimental. El impacto de un fallo parcial es total para el objetivo de la semana. A3 es más tolerante (imágenes pequeñas, CPU) y no entrega el producto geoespacial.

**Justificación de la selección.** Se elige A4 porque es la única que, bajo las restricciones de calendario e infraestructura observadas, produce un análisis verificable con tarea, dataset y modelo nombrados. A1 se conserva como laboratorio secundario. A2 se absorbe: inundación entra como tarea de inferencia, no como nuevo entrenamiento. A3 se descarta como núcleo porque resuelve otro problema.

---

## 10. Diseño y arquitectura

### 10.1 Descripción general de la arquitectura

Tune es una arquitectura **cliente–servidor** en dos contenedores: el navegador (nginx sirviendo el build de Vite, puerto 8080) llama a un backend FastAPI (`eo-api`, puerto 8000). No es Backend as a Service. El backend orquesta el caso de uso `AnalyzeUseCase`, que depende de un segmentador y de un repositorio. La inferencia corre **en el mismo proceso** que la API (sin cola). Esa decisión coincide con A4: un análisis a la vez, menos piezas que fallen en la demo.

El enfoque general es **hexagonal / limpio**, heredado de la v1: las dependencias apuntan hacia el dominio. TerraTorch, rasterio y el sistema de archivos viven en infraestructura e imports perezosos. La alternativa seleccionada (checkpoints publicados) se materializa en `PrithviSegmenter` y `MODEL_CARDS`; el resto del sistema no conoce los nombres de archivo `.pt`.

### 10.2 Componentes del sistema

| Componente | Responsabilidad | Requerimientos |
|---|---|---|
| `web/` (React + Leaflet) | Carga, mapa, stats, historial | RF2, RF5, RF8, RNF7 |
| `eo-api` (FastAPI) | HTTP del análisis, validación de upload | RF1–RF6, RNF4 |
| `AnalyzeUseCase` | Orquesta segmentar → stats → persistir | RF2, RF3, RF7 |
| `PrithviSegmenter` | Pesos HF + ventana 512×512 | RF2, objetivos 2–3 |
| `FileAnalysisRepository` | `artifacts/analyses/<id>/` | RF4, RF5 |
| Volumen `hf-cache` | Pesos entre reinicios | RNF1 |
| CLI Typer | Mismo caso de uso sin UI | RF7 |

Diagrama de arquitectura:

```text
 [Navegador :8080] --/api--> [eo-api :8000]
                                |
                                v
                         AnalyzeUseCase
                          /            \
              HazardSegmenter     AnalysisRepository
                     |                     |
              PrithviSegmenter     archivos en disco
                     |
              Hugging Face (pesos) + TerraTorch
```

(El diagrama formal de cajas para el informe final se tomará de [architecture/v2.md](./architecture/v2.md) y se exportará a figura.)

### 10.3 Interacción entre módulos

El navegador no habla con TerraTorch. Llama JSON a `/api`. El router valida el archivo, escribe un temporal y llama al caso de uso. El segmentador lee el GeoTIFF, selecciona bandas, infiere y devuelve `SegmentationOutput` (máscara tipada como `Any` en el dominio). El caso de uso calcula estadísticas y pide al repositorio que escriba JSON + PNG + GeoTIFF. Las descargas posteriores son `FileResponse` de esos paths.

Dependencias: web → API → aplicación → dominio ← infraestructura. El acoplamiento entre tareas es un diccionario de `ModelCard`. El lab de fine-tuning (`application/stages/*`, MLflow) convive en el mismo paquete y no participa de este flujo.

### 10.4 Comportamiento

Secuencia principal: `UploadPanel` → `POST /api/analyze` → `PrithviSegmenter.segment` → `compute_stats` → `save` → `MapView` con bounds y `mask.png`.

El cuello de botella es la inferencia (y, la primera vez, la descarga). No hay pasos de entrenamiento en el camino. El desacoplamiento se verifica en CI: la API de análisis se prueba con un segmentador falso, de modo que un fallo de torch no impide validar RF1, RF5 y RF6.

Hacia la entrega se añadirán diagramas de secuencia (carga feliz, rechazo 422, fallo 503 por falta de extra).

---

## 11. Implementación y avance actual

### 11.1 Stack tecnológico

Python, FastAPI, Typer, TerraTorch / PyTorch, rasterio, NumPy, React, TypeScript, Vite, Leaflet, Docker Compose, nginx, pytest. Hugging Face Hub para pesos. Persistencia en sistema de archivos (sin PostgreSQL en este ciclo). La imagen de `eo-api` usa `docker/eo/Dockerfile` (torch + terratorch + GDAL).

### 11.2 Componentes implementados

* Dominio de análisis (`HazardTask`, `Analysis`, puertos).
* `AnalyzeUseCase` y `compute_stats`.
* `PrithviSegmenter` (dos `ModelCard`, selección de bandas, sliding window).
* `FileAnalysisRepository`.
* Router `/api` y CLI `tune analyze`.
* Frontend: `UploadPanel`, `MapView`, `StatsCard`, `AnalysisList`.
* Compose perfil `app` y `app`+GPU.
* Laboratorio de fine-tuning (stages, configs YAML, MLflow) presente y fuera del camino de la demo.

### 11.3 Integraciones realizadas

* Hugging Face Hub: `hf_hub_download` de config y `.pt` por tarea, caché `HF_HOME`.
* TerraTorch `LightningInferenceModel.from_config`.
* Leaflet overlay a partir de bounds y PNG.
* Tests de integración de `/api` con dependencias inyectadas.

### 11.4 Pendientes para la entrega final

* Corrida documentada de inferencia real (tiempos CPU, captura de mapa) con un ejemplo de Sen1Floods11 y uno de Burn Scars.
* Figuras de arquitectura y secuencia en el informe.
* Pulido de copy y de estados vacíos / error en la web.
* Decidir si una escena colombiana entra: solo con GeoTIFF de seis bandas y CRS.
* PostGIS, cola y Copernicus siguen fuera.

---

## 12. Despliegue y operación preliminar

El entorno de demo es Docker Compose en máquina local o de laboratorio:

```bash
cp .env.example .env
make app-up          # CPU → http://localhost:8080
make app-up-gpu      # NVIDIA
make app-logs        # primera inferencia: descarga de pesos
make app-down
```

API en `http://localhost:8000/docs`. Dependencias: Docker, y NVIDIA Container Toolkit solo para el perfil GPU. El volumen `hf-cache` evita redesplegar los 1,2 GB. Los análisis quedan en `artifacts/analyses/` del host. No hay ambiente de producción ni URL pública en este avance.

---

## 13. Validación preliminar

### 13.1 Pruebas por componentes

`tests/unit/test_analyze.py` cubre el recuento de píxeles positivos solo sobre válidos, el área ausente sin tamaño de píxel, y la persistencia del caso de uso. `tests/unit/test_prithvi_helpers.py` cubre el passthrough de seis bandas, la extracción L1C para inundación y el rechazo de un número de bandas incorrecto. Esas pruebas fallan si se rompe el contrato de entrada o el cálculo que se muestra en la UI.

### 13.2 Pruebas de integración

`tests/integration/test_api_analyses.py` verifica que `/api/tasks` expone ambos `ibm-nasa-geospatial/...`, que un análisis de prueba se crea y se descarga, y que un no-GeoTIFF o una tarea desconocida se rechazan. El segmentador real no se carga en CI.

### 13.3 Pruebas de usabilidad

Pendientes de una pasada guiada (carga de ejemplo HF, overlay visible, historial recuperable) que se registrará con capturas hacia el cierre. No hay estudio de usuarios externos.

---

## 14. Resultados parciales y discusión

El resultado parcial más importante no es una cifra de mIoU. Es que el sistema **ya expresa** las dos tareas, los dos modelos y el flujo de análisis en código, API y web, y que ese flujo se puede ejercer sin GPU. Eso atiende la retroalimentación del primer informe (compromiso concreto) y el aviso del tutor sobre no depender de fine-tuning largo para cada resultado.

El bloqueo de la imagen Docker en el laboratorio confirma el diagnóstico: un prototipo cuyo único entregable visible es una corrida de entrenamiento hereda todos los fallos de red, disco y VRAM. Mover el núcleo a inferencia publicada no anula el trabajo de arquitectura; lo usa. El riesgo que queda es otro: una demo con un GeoTIFF que no tenga las seis bandas o el CRS, o una primera corrida sin red para bajar pesos. Ambos se mitigan con escenas de ejemplo de los repositorios oficiales, cacheadas de antemano.

Frente a los objetivos, los ítems 1–6 están implementados en el repositorio. El 7 (inferencia real documentada) y el 8 (este informe, en avance) son el trabajo de las semanas de cierre.

---

## 15. Plan de cierre hacia la entrega final

| Prioridad | Actividad | Riesgo si no se hace |
|---|---|---|
| 1 | Demo estable: un GeoTIFF de inundación y uno de cicatriz, pesos ya en caché | No hay resultado que mostrar |
| 2 | Cerrar validación 13.3 con capturas y latencias | Informe sin evidencia de uso |
| 3 | Figuras de arquitectura y secuencia en este documento | Sección 10 incompleta para nota final |
| 4 | Ordenar el repositorio (docs vs código vs lab secundario) | El catálogo se lee como el proyecto v1 |
| 5 | Laboratorio de fine-tuning: no tocar salvo que sobre tiempo | Desvía el cierre |

Estrategia: congelar el contrato de API y de artefactos; no añadir PostGIS ni Copernicus; no reabrir el par experimental como requisito. El informe final ampliará resultados de la demo y afinará redacción; no redefinirá de nuevo el problema.

---

## 16. Referencias

1. Szwarcman, D., Roy, S., Fraccaro, P., et al. (2024). *Prithvi-EO-2.0: A Versatile Multi-Temporal Foundation Model for Earth Observation Applications*. arXiv:2412.02732. https://arxiv.org/abs/2412.02732
2. IBM-NASA Geospatial. *Prithvi-EO-2.0-300M-TL-Sen1Floods11*. Hugging Face. https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M-TL-Sen1Floods11
3. IBM-NASA Geospatial. *Prithvi-EO-2.0-300M-BurnScars*. Hugging Face. https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M-BurnScars
4. Bonafilia, D., Tellman, B., Anderson, T., & Issenberg, E. (2020). Sen1Floods11: A georeferenced dataset to train and test deep learning flood algorithms for Sentinel-1. *Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition Workshops (CVPRW)*, 210–211. https://doi.org/10.1109/CVPRW50498.2020.00113
5. Phillips, C., Roy, S., Ankur, K., & Ramachandran, R. (2023). *HLS Foundation Burnscars Dataset*. Hugging Face. https://doi.org/10.57967/hf/0956
6. Rojas Sánchez, D. S. (2025). *Integración del Modelo Fundacional Geoespacial Prithvi-EO-2.0 en una Arquitectura Visión-Lenguaje para el Análisis Avanzado de Imágenes Satelitales* [Trabajo de grado, Universidad de los Andes]. Repositorio Institucional Séneca.
7. Nogare, D., & Silveira, I. F. (2024). *Experimentation, deployment and monitoring Machine Learning models: Approaches for applying MLOps*. arXiv.
8. Sculley, D., Holt, G., Golovin, D., Davydov, E., Phillips, T., Ebner, D., Chaudhary, V., Young, M., Crespo, J.-F., & Dennison, D. (2015). *Hidden Technical Debt in Machine Learning Systems*. NeurIPS.
9. MLflow. *MLflow Tracking Documentation*. https://mlflow.org/docs/latest/tracking
10. GitHub. *Tune* (repositorio del proyecto). https://github.com/Charlsz/tune

Decisiones internas citadas: [ADR 005](./decisions/005-app-inferencia-checkpoints-publicados.md), [arquitectura v2](./architecture/v2.md). El planteamiento previo permanece en [PrimerInforme.md](./PrimerInforme.md).
