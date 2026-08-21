# Arquitectura MLOps para el ciclo de vida y despliegue de modelos geoespaciales basados en Prithvi

## Resumen / Abstract

La creciente disponibilidad de imágenes satelitales y datos de observación de la Tierra ha impulsado el desarrollo de modelos de inteligencia artificial capaces de apoyar tareas como detección de inundaciones, identificación de áreas afectadas por incendios, clasificación de cultivos y monitoreo de cambios en la superficie terrestre. En este contexto, los modelos fundacionales geoespaciales permiten reutilizar representaciones aprendidas a partir de grandes volúmenes de datos y adaptarlas a diferentes aplicaciones mediante procesos de fine-tuning. Un ejemplo es Prithvi-EO, desarrollado por NASA e IBM, cuya segunda generación fue entrenada con millones de muestras de series temporales provenientes de datos Landsat y Sentinel-2.

Sin embargo, la adaptación de estos modelos a tareas específicas implica gestionar diferentes etapas del ciclo de vida de aprendizaje automático, incluyendo datasets, configuraciones de entrenamiento, experimentos, métricas, versiones de modelos y procesos de despliegue. La existencia de herramientas especializadas para el fine-tuning, como TerraTorch, facilita la adaptación de modelos geoespaciales, pero no elimina la necesidad de establecer procesos reproducibles y automatizados que conecten las etapas experimentales con la evaluación, registro y utilización de los modelos. TerraTorch fue desarrollado como un framework de código abierto orientado precisamente al fine-tuning de modelos fundacionales geoespaciales y proporciona soporte para Prithvi y diferentes tareas de observación de la Tierra.

El presente proyecto, denominado **Terra**, propone diseñar e implementar una arquitectura MLOps orientada a gestionar el ciclo de vida de modelos geoespaciales basados en Prithvi. La arquitectura integrará componentes para la gestión de datasets, ejecución reproducible de fine-tuning, seguimiento de experimentos, evaluación, registro y versionamiento mediante un model registry, automatización de criterios de promoción y despliegue de modelos como servicios de inferencia. Como mecanismo de exposición se implementará una API REST que permita consumir los modelos seleccionados, demostrando la transición desde un modelo experimental hasta un servicio geoespacial reutilizable y controlado.

El desarrollo se realizará mediante un enfoque de prototipado iterativo, dividido en fases de análisis, diseño, implementación, integración y validación. El alcance se concentrará en una tarea geoespacial principal (detección de cicatrices de incendio) y, cuando los recursos lo permitan, en una segunda tarea para validar extensibilidad. La profundidad de la capa de servicio (autenticación, control de uso, métricas y multi-modelo) se definirá mediante una decisión documentada entre dos alternativas, una vez que el núcleo MLOps esté validado. Se espera obtener como resultado una arquitectura reproducible y extensible que permita evaluar tanto el desempeño del modelo como las características del sistema MLOps y del servicio de consumo.

---

# 1. Introducción

La observación de la Tierra constituye un área de creciente importancia para el monitoreo ambiental, la gestión de desastres, la agricultura y el análisis de cambios en la superficie terrestre. El aumento en la disponibilidad de imágenes satelitales y datos multitemporales ha generado nuevas oportunidades para aplicar técnicas de inteligencia artificial sobre información geoespacial. Dentro de esta evolución han surgido los modelos fundacionales geoespaciales, capaces de aprender representaciones generales a partir de grandes colecciones de datos y posteriormente adaptarse a tareas específicas. Prithvi-EO, desarrollado mediante una colaboración entre NASA e IBM, representa uno de estos modelos y ha sido diseñado para aplicaciones de observación de la Tierra. Su segunda generación, Prithvi-EO-2.0, utiliza datos globales provenientes del archivo Harmonized Landsat and Sentinel-2 y contempla modelos de 300 y 600 millones de parámetros.

El crecimiento de estos modelos también ha incrementado la complejidad asociada a su utilización. Una aplicación de aprendizaje automático no depende únicamente del modelo entrenado, sino también de los datos utilizados, las transformaciones aplicadas, los parámetros de entrenamiento, las versiones del código, las métricas obtenidas y las condiciones del entorno de ejecución. En el ámbito de los modelos geoespaciales, estas consideraciones adquieren especial importancia debido a la diversidad de sensores, resoluciones espaciales, bandas espectrales, dimensiones temporales y tareas de análisis. Herramientas como TerraTorch han facilitado el proceso de adaptación de modelos fundacionales geoespaciales mediante fine-tuning y proporcionan configuraciones y ejemplos para tareas como detección de inundaciones, cicatrices de incendios y clasificación de cultivos.

A pesar de estos avances, existe una necesidad de integrar las diferentes etapas involucradas en el ciclo de vida de estos modelos bajo procesos reproducibles y automatizados. El paso desde un experimento de fine-tuning hasta un modelo evaluado y disponible para inferencia puede involucrar múltiples herramientas y procedimientos independientes. Esta fragmentación puede dificultar la trazabilidad entre datasets, experimentos y versiones de modelos, así como la repetición de resultados y la transición de modelos experimentales hacia servicios de inferencia. En este contexto, las prácticas de MLOps proporcionan mecanismos para organizar y automatizar el ciclo de vida de los modelos de aprendizaje automático, incluyendo experiment tracking, versionamiento, evaluación, registro y despliegue.

A partir de esta necesidad se propone **Terra**, una arquitectura MLOps para modelos geoespaciales basados en Prithvi. La solución integrará gestión de datasets, procesos reproducibles de fine-tuning mediante TerraTorch, seguimiento de experimentos y registro de modelos mediante MLflow, y despliegue de modelos seleccionados como servicios de inferencia accesibles mediante una API. La arquitectura será diseñada de manera modular para que una misma infraestructura pueda utilizarse con diferentes tareas geoespaciales y, en una etapa posterior, exponerse como un servicio consumible por terceros, con el nivel de control (autenticación, cuotas, métricas) que se decida según la viabilidad del proyecto.

---

# 2. Planteamiento del problema

## 2.1 Descripción del problema

La incorporación de modelos fundacionales geoespaciales en aplicaciones de observación de la Tierra requiere adaptar modelos previamente entrenados a tareas específicas mediante datasets y procesos de fine-tuning. Aunque existen modelos como Prithvi-EO-2.0 y herramientas como TerraTorch que facilitan esta adaptación, el ciclo de vida completo de un modelo comprende actividades adicionales relacionadas con la gestión de datos, configuración de experimentos, evaluación, versionamiento, registro y despliegue. Prithvi-EO-2.0, por ejemplo, dispone de configuraciones de fine-tuning para diversas tareas, entre ellas detección de inundaciones, detección de cicatrices de incendios, detección de deslizamientos y clasificación de cultivos.

La problemática identificada se encuentra en la dificultad de mantener un proceso integrado, reproducible y trazable a medida que se generan diferentes experimentos y versiones de modelos. Un proceso de desarrollo que dependa de ejecuciones manuales y herramientas desconectadas puede dificultar la identificación de qué dataset, configuración, parámetros y código originaron una determinada versión de un modelo. Esta situación también puede complicar la comparación entre experimentos y la transición controlada de un modelo desde la etapa experimental hacia un entorno de inferencia.

Las personas y equipos que desarrollan aplicaciones basadas en modelos geoespaciales son los principales usuarios afectados por esta situación. La falta de una estrategia integrada de gestión del ciclo de vida puede incrementar el esfuerzo necesario para reproducir experimentos, validar modelos y preparar nuevas versiones para su utilización. En consecuencia, se puede producir una separación entre el proceso de experimentación y el proceso de utilización del modelo como componente de software.

El problema puede sintetizarse de la siguiente manera:

> **La gestión del ciclo de vida de modelos geoespaciales adaptados mediante fine-tuning puede presentar falta de integración, trazabilidad y automatización entre las etapas de preparación de datos, entrenamiento, evaluación, versionamiento y despliegue, dificultando la reproducibilidad de los experimentos y la transición controlada de modelos hacia servicios de inferencia reutilizables y consumibles por terceros.**

La problemática no corresponde a la inexistencia de modelos o herramientas. Por el contrario, existen tecnologías como Prithvi, TerraTorch y MLflow que cubren diferentes partes del proceso. La oportunidad de este proyecto consiste en diseñar y validar una arquitectura que las integre dentro de un flujo MLOps orientado al ciclo de vida de modelos geoespaciales, incluyendo la exposición controlada del modelo como servicio.

## 2.2 Justificación

El desarrollo de una arquitectura de este tipo resulta pertinente desde una perspectiva técnica y académica debido a la creciente utilización de modelos fundacionales y técnicas de aprendizaje por transferencia en observación de la Tierra. Prithvi-EO-2.0 ha sido diseñado para ser utilizado en múltiples tareas y su publicación incluye modelos y configuraciones para diferentes aplicaciones geoespaciales. Esto convierte al modelo en un caso adecuado para estudiar cómo una infraestructura común puede soportar diferentes procesos de adaptación.

Desde el punto de vista de Ingeniería de Sistemas, el problema permite integrar conocimientos relacionados con arquitectura de software, ingeniería de datos, inteligencia artificial, automatización, contenedores, servicios web y gestión de sistemas de aprendizaje automático. El proyecto no se limita al entrenamiento de un modelo, sino que aborda la interacción entre diferentes componentes de software necesarios para administrar su ciclo de vida.

La incorporación de mecanismos de experiment tracking y model registry permite mejorar la trazabilidad de los resultados. MLflow, por ejemplo, proporciona capacidades para registrar versiones de modelos, asociarlas con ejecuciones experimentales y almacenar metadatos relacionados con su origen y evolución. Su Model Registry permite administrar versiones y establecer referencias que pueden utilizarse durante los procesos de despliegue.

Finalmente, el proyecto puede aportar una arquitectura reutilizable para diferentes tareas de observación de la Tierra. En lugar de diseñar una solución independiente para cada aplicación, se busca establecer componentes comunes que permitan incorporar nuevos modelos o tareas con modificaciones limitadas, y exponer los modelos aprobados como servicios consumibles. De esta manera, la propuesta puede contribuir al estudio académico de prácticas MLOps aplicadas a modelos geoespaciales y a la construcción de una prueba de concepto técnicamente reproducible.

## 2.3 Restricciones y supuestos iniciales

El proyecto estará condicionado por las siguientes restricciones y supuestos:

* El proyecto tendrá carácter académico y de prototipo funcional; no se pretende alcanzar disponibilidad, seguridad ni escalabilidad de una plataforma comercial.
* La disponibilidad de recursos GPU puede limitar el tamaño, número y duración de los experimentos de fine-tuning.
* Se utilizarán datasets públicos o aquellos que puedan emplearse legalmente en el contexto académico.
* Se definirá una tarea geoespacial principal (Wildfire Scar Detection) y una segunda tarea (Flood Detection) quedará como extensión opcional.
* La arquitectura se diseñará para permitir extensibilidad, pero no se implementarán todas las tareas soportadas por Prithvi.
* El uso de infraestructura cloud se considerará únicamente cuando aporte valor a la validación y sea viable según los recursos disponibles.
* La autenticación empresarial (por ejemplo OAuth2), la facturación real y el multi-tenancy productivo no forman parte del alcance obligatorio.
* La profundidad de la capa de servicio (API keys, rate limiting, métricas de uso, multi-modelo y scaling básico) se decidirá entre dos alternativas documentadas, una vez validado el núcleo MLOps.
* Kubernetes, despliegue multi-cloud y orquestadores productivos se documentarán como trabajo futuro, no como requisito de implementación.
* La arquitectura podrá ejecutarse inicialmente en un entorno controlado mediante contenedores.

---

# 3. Alcance del proyecto

El proyecto comprende el diseño e implementación de un prototipo de arquitectura MLOps (**Terra**) para gestionar el ciclo de vida de modelos geoespaciales basados en Prithvi y exponerlos como servicios de inferencia consumibles.

## Incluye

### Gestión de datasets

* Registro de datasets utilizados en los experimentos.
* Identificación de versiones.
* Asociación entre datasets y tareas geoespaciales.
* Registro de metadatos relevantes para reproducibilidad.
* Organización del flujo de datos requerido para entrenamiento y evaluación.

### Fine-tuning

* Integración de Prithvi-EO-2.0 (variante 300M-TL como referencia inicial).
* Utilización de TerraTorch para procesos de adaptación.
* Configuración reproducible de experimentos.
* Ejecución de procesos de entrenamiento y validación sobre la tarea principal: Wildfire Scar Detection (HLS Burn Scars).

### Experiment tracking

* Registro de parámetros.
* Registro de métricas.
* Registro de artefactos.
* Asociación entre experimentos y versiones de modelos.

### Model Registry

* Registro de modelos entrenados.
* Versionamiento de modelos.
* Asociación de modelos con sus métricas y experimentos.
* Definición de estados o criterios de promoción (por ejemplo: trained, evaluated, candidate, approved).

MLflow será considerado como la tecnología principal para este componente debido a sus capacidades de tracking y Model Registry.

### Evaluación y promoción

* Definición de métricas específicas para las tareas seleccionadas.
* Evaluación automática de modelos.
* Establecimiento de criterios mínimos de desempeño.
* Identificación de modelos aptos para despliegue.

### Despliegue

* Empaquetado de modelos mediante contenedores.
* Implementación de un servicio de inferencia.
* Integración entre el modelo registrado y el servicio de inferencia.

### API y capa de servicio

* Desarrollo de una API REST para consumir los modelos desplegados.
* Endpoint o endpoints asociados a las tareas seleccionadas.
* Consulta de información básica sobre modelos y versiones.
* Documentación de la API.
* Evaluación documentada de dos alternativas para la capa de servicio:
  * **Opción A:** servicio geoespacial más completo (autenticación básica, API keys, rate limiting, logging de uso, métricas, diseño multi-modelo y, si es viable, scaling horizontal básico con contenedores).
  * **Opción B:** servicio controlado mínimo (API key, rate limit básico, logging y métricas simples).
* La elección entre A y B se realizará una vez validado el núcleo MLOps (fine-tuning reproducible, tracking, registry, pipeline y API básica), y se registrará mediante un ADR.

### Validación

* Evaluación de reproducibilidad.
* Evaluación del funcionamiento del pipeline.
* Comparación de resultados de diferentes versiones.
* Medición de tiempos relevantes del flujo (entrenamiento, pipeline e inferencia).
* Evaluación de indicadores de la capa de servicio según la opción implementada (por ejemplo latencia, tasa de error, rechazo sin autenticación).
* Validación de la extensibilidad mediante una segunda tarea geoespacial, cuando los recursos disponibles lo permitan.

## No incluye

* Construcción de un nuevo foundation model desde cero.
* Preentrenamiento de Prithvi.
* Implementación de todas las tareas geoespaciales disponibles.
* Plataforma comercial de inteligencia artificial geoespacial.
* Sistema de facturación real o pasarelas de pago.
* Multi-tenancy empresarial.
* Autenticación empresarial avanzada (por ejemplo OAuth2 completo) como requisito obligatorio.
* Garantías de disponibilidad propias de sistemas productivos.
* Despliegue obligatorio en múltiples proveedores cloud.
* Implementación obligatoria de Kubernetes u orquestadores productivos.
* Construcción de un cluster GPU propio.
* Desarrollo de una aplicación móvil o frontend complejo.
* Operación y mantenimiento posterior a la finalización del proyecto.

El resultado esperado corresponde a un **prototipo funcional y validado de una arquitectura MLOps con exposición de modelos como servicio**, no a una plataforma comercial lista para producción a gran escala.

---

# 4. Objetivos

## 4.1 Objetivo general

**Diseñar e implementar una arquitectura MLOps reproducible (Terra) para gestionar el ciclo de vida de modelos geoespaciales basados en Prithvi, integrando la gestión de datasets, fine-tuning, evaluación, versionamiento, registro, despliegue y exposición mediante servicios API consumibles.**

## 4.2 Objetivos específicos

1. **Diseñar** una arquitectura modular que integre los componentes necesarios para gestionar el ciclo de vida de modelos geoespaciales basados en Prithvi.

2. **Implementar** un flujo reproducible para la gestión y versionamiento de datasets utilizados en procesos de fine-tuning.

3. **Integrar** TerraTorch en un pipeline de entrenamiento que permita ejecutar y registrar experimentos de adaptación de Prithvi para la tarea principal (Wildfire Scar Detection) y, cuando sea viable, para una segunda tarea.

4. **Implementar** mecanismos de seguimiento y registro de experimentos, métricas y versiones de modelos mediante una plataforma de experiment tracking y model registry.

5. **Automatizar** la evaluación de modelos y establecer criterios verificables para determinar qué versiones pueden avanzar hacia la etapa de despliegue.

6. **Desarrollar** servicios de inferencia y una API REST que permitan consumir los modelos seleccionados desde aplicaciones externas, incluyendo la versión del modelo en las respuestas.

7. **Evaluar y documentar** dos alternativas de capa de servicio (plataforma más completa vs servicio controlado mínimo) y seleccionar una mediante criterios explícitos una vez validado el núcleo MLOps.

8. **Evaluar** la arquitectura mediante indicadores de desempeño del modelo, reproducibilidad, automatización, comportamiento del servicio de inferencia y, cuando sea viable, extensibilidad a una segunda tarea.

---

# 5. Solución propuesta

La solución propuesta, denominada **Terra**, consistirá en una arquitectura modular orientada a gestionar el ciclo de vida de modelos geoespaciales basados en Prithvi y a exponer modelos aprobados como servicios de inferencia consumibles.

La arquitectura se organizará en diferentes componentes:

```text
                         ┌─────────────────────┐
                         │   Capa de servicio  │
                         │  (API / Gateway)    │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
             Burn Scars Service              Flood Service
               (tarea principal)            (extensión opcional)
                    │                               │
               Prithvi-B                       Prithvi-F
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                              Model Registry
                                 (MLflow)
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
              Model Versions                    Metrics
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                         MLOps Pipeline (script)
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
           Dataset Management              Training Jobs
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                              TerraTorch
                                    │
                                    ▼
                           Prithvi-EO-2.0
```

El flujo comenzará con la incorporación de un dataset asociado a una tarea específica. Como tarea principal se propone **Wildfire Scar Detection** (HLS Burn Scars), por disponer de dataset público, configuraciones oficiales de TerraTorch y ejemplos reproducibles. Flood Detection se contempla como extensión opcional para validar reutilización.

Posteriormente, un proceso de entrenamiento ejecutará el fine-tuning de Prithvi mediante TerraTorch. Durante el entrenamiento se registrarán parámetros, métricas y artefactos. Una vez finalizado el proceso, el modelo será evaluado mediante métricas apropiadas para la tarea (IoU, mIoU, F1, precision y recall). Los resultados determinarán si el modelo cumple los criterios para ser registrado y potencialmente promovido.

MLflow será utilizado como componente de experiment tracking y model registry. Los modelos que cumplan los criterios definidos podrán empaquetarse y desplegarse como servicios de inferencia. La API permitirá que un consumidor externo envíe una solicitud y reciba la predicción correspondiente, junto con metadatos de trazabilidad (por ejemplo, versión del modelo).

Respecto a la capa de servicio, el proyecto contemplará **dos alternativas**, a decidir tras validar el núcleo MLOps:

* **Opción A (Geospatial AI Service):** autenticación básica, API keys, rate limiting, logging de uso, métricas, diseño multi-modelo y, si es viable, scaling horizontal básico con contenedores. Cloud, Kubernetes, OAuth2 empresarial y billing real se documentarán como trabajo futuro.
* **Opción B (servicio controlado mínimo):** API key, rate limit básico, logging y métricas simples, manteniendo el mismo flujo de inferencia con menor superficie de implementación.

La decisión se registrará en un ADR con criterios explícitos (estado del núcleo, tiempo disponible, estabilidad de GPU y capacidad del equipo).

El flujo conceptual será:

```text
Dataset
   ↓
Dataset Version
   ↓
Preprocessing
   ↓
Fine-tuning Prithvi
   ↓
Experiment Tracking
   ↓
Evaluation
   ↓
Model Registry
   ↓
Validation Threshold
   ↓
Deployment
   ↓
Inference Service
   ↓
REST API / Service Layer
   ↓
Demo / Consumer
```

Una característica fundamental de la propuesta será la separación entre los componentes específicos de cada tarea y los componentes generales de infraestructura. De esta manera, un servicio destinado a detección de cicatrices de incendio podrá reutilizar el mismo pipeline MLOps que otro destinado a detección de inundaciones, cambiando principalmente el dataset, la configuración, el modelo adaptado y las métricas específicas.

Prithvi-EO-2.0 resulta especialmente adecuado para demostrar esta característica debido a que su distribución incluye configuraciones y datasets para múltiples tareas downstream, incluyendo Flood Detection y Wildfire Scar Detection.

---

# 6. Estado del arte / soluciones relacionadas

## 6.1 Modelos fundacionales geoespaciales

Los modelos fundacionales han extendido el paradigma de aprendizaje por transferencia hacia dominios especializados como la observación de la Tierra. En lugar de entrenar un modelo independiente desde cero para cada aplicación, estos modelos pueden ser preentrenados sobre grandes colecciones de datos y posteriormente adaptados a tareas específicas.

Prithvi-EO constituye un ejemplo de este enfoque. Prithvi-EO-2.0 fue desarrollado mediante una colaboración de diferentes instituciones y fue preentrenado utilizando aproximadamente 4.2 millones de muestras globales de series temporales provenientes de datos Harmonized Landsat and Sentinel-2. La segunda generación contempla modelos de 300M y 600M de parámetros y utiliza información espacial y temporal durante el proceso de aprendizaje.

La disponibilidad de modelos previamente entrenados reduce la necesidad de comenzar el entrenamiento desde cero y permite investigar procesos de adaptación para diferentes dominios. Sin embargo, este enfoque también genera la necesidad de administrar sistemáticamente las diferentes versiones de datos, configuraciones y modelos derivados.

## 6.2 TerraTorch

TerraTorch es un framework de código abierto orientado al fine-tuning de modelos fundacionales geoespaciales. Está basado en PyTorch Lightning y utiliza componentes del ecosistema TorchGeo para trabajar con datos geoespaciales. El framework permite integrar modelos previamente entrenados y facilitar su adaptación a tareas downstream.

El repositorio de Prithvi-EO-2.0 incluye configuraciones de TerraTorch para diferentes tareas, entre ellas detección de inundaciones, detección de cicatrices de incendios, detección de deslizamientos y clasificación de cultivos.

TerraTorch resuelve principalmente la problemática relacionada con la adaptación de modelos. Sin embargo, su función dentro del presente proyecto será la de componente de entrenamiento dentro de una arquitectura de mayor alcance.

## 6.3 MLflow

MLflow proporciona herramientas para administrar diferentes etapas del ciclo de vida de modelos de aprendizaje automático. Su componente de tracking permite registrar ejecuciones experimentales y métricas, mientras que el Model Registry proporciona mecanismos para gestionar versiones y metadatos de modelos.

Esta funcionalidad resulta relevante para el proyecto debido a la necesidad de relacionar una versión de modelo con el experimento que la produjo. Además, MLflow permite utilizar identificadores de versiones y aliases para referenciar modelos concretos durante procesos de inferencia o despliegue.

## 6.4 Prácticas MLOps

MLOps surge como un conjunto de prácticas orientadas a gestionar de manera sistemática el ciclo de vida de sistemas de aprendizaje automático. Entre sus preocupaciones se encuentran la integración entre experimentación y producción, automatización de procesos, despliegue y monitoreo de modelos.

Para el presente proyecto, MLOps se considera no como una herramienta específica, sino como el enfoque arquitectónico que permitirá conectar las etapas de gestión de datos, entrenamiento, evaluación, registro y despliegue.

## 6.5 Comparación

| Solución / enfoque     | Fine-tuning | Experiment tracking | Model registry | Deployment | API / servicio | Multi-tarea |
| ---------------------- | ----------: | ------------------: | -------------: | ---------: | -------------: | ----------: |
| Prithvi-EO-2.0         |          Sí |   Parcial / externo |        Externo |    Posible |        Externa |          Sí |
| TerraTorch             |          Sí |          Integrable |        Externo | Integrable | No es su foco  |          Sí |
| MLflow                 |          No |                  Sí |             Sí | Integrable |     Integrable |     General |
| Arquitectura Terra     |          Sí |                  Sí |             Sí |         Sí |             Sí |          Sí |

La comparación evidencia que las herramientas existentes cubren diferentes componentes del ciclo de vida. Prithvi proporciona el foundation model y recursos para diferentes tareas; TerraTorch facilita el fine-tuning; y MLflow proporciona capacidades de tracking y model registry.

Por tanto, el aporte planteado no consiste en reemplazar estas tecnologías, sino en **integrarlas dentro de una arquitectura MLOps reproducible (Terra) orientada al ciclo de vida de modelos geoespaciales basados en Prithvi y a su exposición como servicio consumible**.

Esta integración constituye el principal vacío técnico que abordará el proyecto.

---

# 7. Metodología de desarrollo y plan de trabajo

## 7.1 Enfoque metodológico

El proyecto utilizará un enfoque de **prototipado iterativo**, debido a que la arquitectura combina componentes de inteligencia artificial, procesamiento de datos, infraestructura y servicios de software cuya integración debe validarse progresivamente.

El desarrollo se organizará mediante ciclos sucesivos de:

```text
Diseño
   ↓
Implementación
   ↓
Integración
   ↓
Prueba
   ↓
Evaluación
   ↓
Ajuste
   ↓
Nueva iteración
```

Este enfoque permitirá reducir el riesgo de intentar construir toda la arquitectura simultáneamente y permitirá validar cada componente antes de incorporar nuevas capas.

La metodología estará orientada a resultados verificables. Cada iteración producirá un componente funcional, una evidencia de validación y documentación asociada.

## 7.2 Iteraciones o fases de desarrollo

### Iteración 1: Análisis y definición arquitectónica

**Propósito:** establecer los requerimientos, límites y arquitectura inicial.

Actividades:

* Revisión de literatura.
* Revisión de Prithvi-EO-2.0.
* Revisión de TerraTorch.
* Revisión de herramientas MLOps.
* Selección de la tarea principal (Wildfire Scar Detection) y de la extensión opcional (Flood Detection).
* Identificación de datasets.
* Definición de requisitos funcionales y no funcionales.
* Diseño inicial de la arquitectura Terra.
* Definición preliminar de las alternativas de capa de servicio (Opción A y Opción B).

**Resultado esperado:**

* Requerimientos.
* Arquitectura inicial.
* Selección tecnológica.
* Dataset y tarea principal seleccionados.
* Criterios preliminares para decidir la profundidad de la capa de servicio.

---

### Iteración 2: Preparación de datos y fine-tuning

**Propósito:** implementar el flujo básico de entrenamiento.

Actividades:

* Preparación del dataset HLS Burn Scars.
* Versionamiento de configuraciones.
* Configuración de TerraTorch.
* Ejecución de fine-tuning.
* Validación inicial.
* Registro de parámetros y métricas.

**Resultado esperado:**

* Primer modelo fine-tuned.
* Pipeline de entrenamiento reproducible.
* Métricas iniciales.

---

### Iteración 3: Experiment tracking y Model Registry

**Propósito:** integrar mecanismos de trazabilidad y gestión de versiones.

Actividades:

* Configuración de MLflow.
* Registro de experimentos.
* Registro de métricas.
* Registro de artefactos.
* Registro de modelos.
* Definición de metadata.
* Gestión de versiones y estados de promoción.

**Resultado esperado:**

* Experimentos trazables.
* Modelos versionados.
* Relación entre dataset, experimento y modelo.

---

### Iteración 4: Evaluación y automatización

**Propósito:** automatizar la evaluación y definir criterios de promoción.

Actividades:

* Definición de métricas.
* Implementación de evaluación automática.
* Definición de thresholds.
* Validación de modelos.
* Automatización de la promoción de modelos que cumplan los criterios.
* Implementación del pipeline script (prepare → train → evaluate → register).

**Resultado esperado:**

```text
Training
   ↓
Evaluation
   ↓
Threshold
   ├── FAIL → Reject
   │
   └── PASS → Registry
```

---

### Iteración 5: Deployment y API básica

**Propósito:** transformar el modelo registrado en un servicio consumible mínimo.

Actividades:

* Empaquetado del modelo.
* Construcción del servicio de inferencia.
* Contenerización.
* Desarrollo de API REST (`/health`, `/model`, `/predict`).
* Inclusión de versión del modelo y latencia en las respuestas.
* Integración con el Model Registry.
* Pruebas de inferencia.
* Documentación de endpoints.

**Resultado esperado:**

* Modelo desplegado.
* Servicio de inferencia.
* API funcional (núcleo).

---

### Iteración 6: Capa de servicio (decisión A/B) y demo

**Propósito:** decidir e implementar la profundidad de la capa de servicio, y demostrar el consumo externo.

**Gate previo obligatorio:** baseline reproducible, MLflow, pipeline, API básica y contenedor de API funcionando.

Actividades:

* Evaluación documentada de Opción A vs Opción B.
* Registro de la decisión en un ADR.
* Implementación de la opción seleccionada.
* Construcción de una demo de consumo del servicio.
* Si se elige Opción A: autenticación básica, API keys, rate limiting, logging de uso, métricas y, si es viable, multi-instancia con contenedores.
* Si se elige Opción B: API key, rate limit básico, logging y métricas simples.
* Documentación de cloud/Kubernetes/OAuth2/billing como trabajo futuro.

**Resultado esperado:**

* ADR de decisión de capa de servicio.
* Servicio implementado según la opción elegida.
* Demo de consumo externo.

---

### Iteración 7: Extensión y validación final

**Propósito:** evaluar el sistema y, si es viable, demostrar reutilización.

Actividades:

* Incorporación de una segunda tarea geoespacial (Flood), si los recursos disponibles lo permiten y no compromete la capa de servicio.
* Reutilización de componentes existentes.
* Comparación de resultados.
* Pruebas de reproducibilidad.
* Evaluación de desempeño del modelo, del pipeline y del servicio.
* Documentación final.

**Resultado esperado:**

* Evidencia de extensibilidad (si aplica).
* Resultados experimentales.
* Evaluación final de la arquitectura Terra.

---

## 7.3 Estrategia de validación

La validación se realizará desde cinco perspectivas.

### Validación funcional

Se verificará que cada componente cumpla las funciones definidas:

* Registrar datasets.
* Ejecutar entrenamiento.
* Registrar experimentos.
* Registrar modelos.
* Evaluar modelos.
* Promover modelos.
* Ejecutar inferencias.
* Responder mediante la API.
* Aplicar los controles de la capa de servicio según la opción implementada.

### Validación de reproducibilidad

Se intentará repetir un experimento utilizando la misma versión de dataset, configuración y código, verificando que el proceso pueda reconstruirse y que los resultados se encuentren correctamente asociados a los artefactos correspondientes.

### Validación de desempeño del modelo

Se medirán indicadores como:

* Métricas específicas de la tarea (IoU, mIoU, F1, precision y recall para segmentación).
* Tiempo de entrenamiento.
* Tiempo de ejecución del pipeline.
* Uso de recursos computacionales, cuando sea posible.

### Validación de la capa de servicio

Según la opción implementada (A o B), se podrán medir:

* Latencia de inferencia (incluyendo p50 / p95 cuando sea viable).
* Tasa de error.
* Comportamiento ante solicitudes sin autenticación o que excedan cuota (si aplica).
* Requests por consumidor / API key (si aplica).
* Comportamiento básico de scaling, solo si se implementa en Opción A.

### Validación de extensibilidad

Se buscará demostrar que la incorporación de una segunda tarea no requiere modificar los componentes centrales de la arquitectura. Esto permitirá evaluar si la infraestructura diseñada realmente puede funcionar como una arquitectura reutilizable.

---

## 7.4 Plan de trabajo, cronograma e hitos

Considerando un periodo aproximado de tres meses, se propone el siguiente cronograma inicial:

| Fase | Semanas | Actividades principales | Entregable |
| --- | ---: | --- | --- |
| 1. Investigación | 1-2 | Estado del arte, Prithvi, TerraTorch, MLOps | Marco conceptual y requisitos |
| 2. Arquitectura | 2-3 | Diseño Terra, tarea principal y alternativas A/B | Arquitectura inicial |
| 3. Datos | 3-4 | Preparación HLS Burn Scars | Dataset preparado |
| 4. Fine-tuning | 4-6 | Entrenamiento reproducible con TerraTorch | Primer modelo |
| 5. Tracking | 6-7 | MLflow y experiment tracking | Experimentos registrados |
| 6. Model Registry | 7-8 | Versionamiento y promoción | Model Registry funcional |
| 7. Automatización | 8-9 | Pipeline prepare-train-evaluate-register | Pipeline automatizado |
| 8. Deployment y API | 9-10 | Contenedores e inferencia básica | API funcional (núcleo) |
| 9. Capa de servicio | 10-11 | Decisión A/B, implementación y demo | Servicio + demo |
| 10. Validación | 11-12 | Métricas ML, MLOps y servicio; Flood opcional | Resultados |
| 11. Documentación | 12 | Análisis y documentación final | Informe final |

El cronograma podrá modificarse de acuerdo con la disponibilidad de infraestructura computacional, resultados obtenidos durante los experimentos y retroalimentación del mentor. La regla de prioridad será: primero el experimento Prithvi reproducible; después tracking y pipeline; después API; y solo entonces la profundidad de la capa de servicio.

---

# 8. Referencias

[1] Szwarcman, D., Roy, S., Fraccaro, P., et al. *Prithvi-EO-2.0: A Versatile Multi-Temporal Foundation Model for Earth Observation Applications*. arXiv, 2024.

[2] NASA Science. *NASA’s Prithvi Becomes First AI Geospatial Foundation Model In Orbit*. 2026.

[3] NASA Science. *Expanded AI Model with Global Data Enhances Earth Science Applications*. 2024.

[4] NASA-IMPACT. *Prithvi-EO-2.0: A Versatile Multi-Temporal Foundation Model for Earth Observation Applications*. GitHub repository.

[5] IBM Research. *TerraTorch: an Open-source Framework for Fine-tuning Geospatial Foundation Models*. 2024.

[6] TerraTorch. *TerraTorch Documentation*. IBM / TorchGeo.

[7] MLflow. *MLflow Model Registry Documentation*.

[8] MLflow. *MLflow Tracking Documentation*.

[9] MLflow. *Model Registry Workflows*.

[10] Nogare, D., & Silveira, I. F. *Experimentation, deployment and monitoring Machine Learning models: Approaches for applying MLOps*. arXiv, 2024.
