# Arquitectura MLOps para el ciclo de vida y despliegue de modelos geoespaciales basados en Prithvi

## Resumen / Abstract

La creciente disponibilidad de imágenes satelitales y datos de observación de la Tierra ha impulsado el desarrollo de modelos de inteligencia artificial capaces de apoyar tareas como detección de inundaciones, identificación de áreas afectadas por incendios, clasificación de cultivos y monitoreo de cambios en la superficie terrestre. En este contexto, los modelos fundacionales geoespaciales permiten reutilizar representaciones aprendidas a partir de grandes volúmenes de datos y adaptarlas a diferentes aplicaciones mediante procesos de fine-tuning. Un ejemplo es Prithvi-EO, desarrollado por NASA e IBM, cuya segunda generación fue entrenada con millones de muestras de series temporales provenientes de datos Landsat y Sentinel-2.

Sin embargo, la adaptación de estos modelos a tareas específicas implica gestionar diferentes etapas del ciclo de vida de aprendizaje automático, incluyendo datasets, configuraciones de entrenamiento, experimentos, métricas, versiones de modelos y procesos de despliegue. La existencia de herramientas especializadas para el fine-tuning, como TerraTorch, facilita la adaptación de modelos geoespaciales, pero no elimina la necesidad de establecer procesos reproducibles y automatizados que conecten las etapas experimentales con la evaluación, registro y utilización de los modelos. TerraTorch fue desarrollado como un framework de código abierto orientado precisamente al fine-tuning de modelos fundacionales geoespaciales y proporciona soporte para Prithvi y diferentes tareas de observación de la Tierra.

El presente proyecto propone diseñar e implementar una arquitectura MLOps orientada a gestionar el ciclo de vida de modelos geoespaciales basados en Prithvi. La arquitectura integrará componentes para el versionamiento y gestión de datasets, ejecución reproducible de procesos de fine-tuning, seguimiento de experimentos, evaluación de modelos, registro y versionamiento mediante un model registry, automatización de criterios de promoción y despliegue de modelos como servicios de inferencia. Como mecanismo de exposición se implementará una API que permita consumir los modelos seleccionados, demostrando la transición desde un modelo experimental hasta un servicio reutilizable.

El desarrollo se realizará mediante un enfoque de prototipado iterativo, dividido en fases de análisis, diseño, implementación, integración y validación. El alcance se limitará inicialmente a una o dos tareas de observación de la Tierra soportadas por Prithvi, con el propósito de demostrar la reutilización de la arquitectura sin convertir el proyecto en una implementación productiva a gran escala. Se espera obtener como resultado una arquitectura reproducible y extensible que permita evaluar la automatización del ciclo de vida de modelos geoespaciales y establecer una base para su posterior utilización en diferentes tareas y contextos de observación de la Tierra.

---

# 1. Introducción

La observación de la Tierra constituye un área de creciente importancia para el monitoreo ambiental, la gestión de desastres, la agricultura y el análisis de cambios en la superficie terrestre. El aumento en la disponibilidad de imágenes satelitales y datos multitemporales ha generado nuevas oportunidades para aplicar técnicas de inteligencia artificial sobre información geoespacial. Dentro de esta evolución han surgido los modelos fundacionales geoespaciales, capaces de aprender representaciones generales a partir de grandes colecciones de datos y posteriormente adaptarse a tareas específicas. Prithvi-EO, desarrollado mediante una colaboración entre NASA e IBM, representa uno de estos modelos y ha sido diseñado para aplicaciones de observación de la Tierra. Su segunda generación, Prithvi-EO-2.0, utiliza datos globales provenientes del archivo Harmonized Landsat and Sentinel-2 y contempla modelos de 300 y 600 millones de parámetros.

El crecimiento de estos modelos también ha incrementado la complejidad asociada a su utilización. Una aplicación de aprendizaje automático no depende únicamente del modelo entrenado, sino también de los datos utilizados, las transformaciones aplicadas, los parámetros de entrenamiento, las versiones del código, las métricas obtenidas y las condiciones del entorno de ejecución. En el ámbito de los modelos geoespaciales, estas consideraciones adquieren especial importancia debido a la diversidad de sensores, resoluciones espaciales, bandas espectrales, dimensiones temporales y tareas de análisis. Herramientas como TerraTorch han facilitado el proceso de adaptación de modelos fundacionales geoespaciales mediante fine-tuning y proporcionan configuraciones y ejemplos para tareas como detección de inundaciones, cicatrices de incendios y clasificación de cultivos.

A pesar de estos avances, existe una necesidad de integrar las diferentes etapas involucradas en el ciclo de vida de estos modelos bajo procesos reproducibles y automatizados. El paso desde un experimento de fine-tuning hasta un modelo evaluado y disponible para inferencia puede involucrar múltiples herramientas y procedimientos independientes. Esta fragmentación puede dificultar la trazabilidad entre datasets, experimentos y versiones de modelos, así como la repetición de resultados y la transición de modelos experimentales hacia servicios de inferencia. En este contexto, las prácticas de MLOps proporcionan mecanismos para organizar y automatizar el ciclo de vida de los modelos de aprendizaje automático, incluyendo experiment tracking, versionamiento, evaluación, registro y despliegue.

A partir de esta necesidad se propone una arquitectura MLOps para modelos geoespaciales basados en Prithvi, denominada provisionalmente **GeoPrithvi MLOps**. La solución integrará gestión de datasets, procesos reproducibles de fine-tuning mediante TerraTorch, seguimiento de experimentos, evaluación, registro de modelos mediante MLflow y despliegue de modelos seleccionados como servicios de inferencia accesibles mediante una API. La arquitectura será diseñada de manera modular para que una misma infraestructura pueda ser utilizada con diferentes tareas geoespaciales, demostrando su potencial de reutilización y extensibilidad.

---

# 2. Planteamiento del problema

## 2.1 Descripción del problema

La incorporación de modelos fundacionales geoespaciales en aplicaciones de observación de la Tierra requiere adaptar modelos previamente entrenados a tareas específicas mediante datasets y procesos de fine-tuning. Aunque existen modelos como Prithvi-EO-2.0 y herramientas como TerraTorch que facilitan esta adaptación, el ciclo de vida completo de un modelo comprende actividades adicionales relacionadas con la gestión de datos, configuración de experimentos, evaluación, versionamiento, registro y despliegue. Prithvi-EO-2.0, por ejemplo, dispone de configuraciones de fine-tuning para diversas tareas, entre ellas detección de inundaciones, detección de cicatrices de incendios, detección de deslizamientos y clasificación de cultivos.

La problemática identificada se encuentra en la dificultad de mantener un proceso integrado, reproducible y trazable a medida que se generan diferentes experimentos y versiones de modelos. Un proceso de desarrollo que dependa de ejecuciones manuales y herramientas desconectadas puede dificultar la identificación de qué dataset, configuración, parámetros y código originaron una determinada versión de un modelo. Esta situación también puede complicar la comparación entre experimentos y la transición controlada de un modelo desde la etapa experimental hacia un entorno de inferencia.

Las personas y equipos que desarrollan aplicaciones basadas en modelos geoespaciales son los principales usuarios afectados por esta situación. La falta de una estrategia integrada de gestión del ciclo de vida puede incrementar el esfuerzo necesario para reproducir experimentos, validar modelos y preparar nuevas versiones para su utilización. En consecuencia, se puede producir una separación entre el proceso de experimentación y el proceso de utilización del modelo como componente de software.

El problema puede sintetizarse de la siguiente manera:

> **La gestión del ciclo de vida de modelos geoespaciales adaptados mediante fine-tuning puede presentar falta de integración, trazabilidad y automatización entre las etapas de preparación de datos, entrenamiento, evaluación, versionamiento y despliegue, dificultando la reproducibilidad de los experimentos y la transición controlada de modelos hacia servicios de inferencia reutilizables.**

La problemática no corresponde a la inexistencia de modelos o herramientas. Por el contrario, existen tecnologías como Prithvi, TerraTorch y MLflow que cubren diferentes partes del proceso. La oportunidad de este proyecto consiste en diseñar y validar una arquitectura que integre dichos componentes dentro de un flujo MLOps orientado específicamente al ciclo de vida de modelos geoespaciales.

## 2.2 Justificación

El desarrollo de una arquitectura de este tipo resulta pertinente desde una perspectiva técnica y académica debido a la creciente utilización de modelos fundacionales y técnicas de aprendizaje por transferencia en observación de la Tierra. Prithvi-EO-2.0 ha sido diseñado para ser utilizado en múltiples tareas y su publicación incluye modelos y configuraciones para diferentes aplicaciones geoespaciales. Esto convierte al modelo en un caso adecuado para estudiar cómo una infraestructura común puede soportar diferentes procesos de adaptación.

Desde el punto de vista de Ingeniería de Sistemas, el problema permite integrar conocimientos relacionados con arquitectura de software, ingeniería de datos, inteligencia artificial, automatización, contenedores, servicios web y gestión de sistemas de aprendizaje automático. El proyecto no se limita al entrenamiento de un modelo, sino que aborda la interacción entre diferentes componentes de software necesarios para administrar su ciclo de vida.

La incorporación de mecanismos de experiment tracking y model registry permite mejorar la trazabilidad de los resultados. MLflow, por ejemplo, proporciona capacidades para registrar versiones de modelos, asociarlas con ejecuciones experimentales y almacenar metadatos relacionados con su origen y evolución. Su Model Registry permite administrar versiones y establecer referencias que pueden utilizarse durante los procesos de despliegue.

Finalmente, el proyecto puede aportar una arquitectura reutilizable para diferentes tareas de observación de la Tierra. En lugar de diseñar una solución independiente para cada aplicación, se busca establecer componentes comunes que permitan incorporar nuevos modelos o tareas con modificaciones limitadas. De esta manera, la propuesta puede contribuir tanto al estudio académico de prácticas MLOps aplicadas a modelos geoespaciales como a la construcción de una prueba de concepto técnicamente reproducible.

## 2.3 Restricciones y supuestos iniciales

El proyecto estará condicionado por las siguientes restricciones y supuestos:

* El proyecto tendrá carácter académico y de prototipo funcional, por lo que no se pretende alcanzar las características de disponibilidad, seguridad y escalabilidad de una plataforma comercial.
* La disponibilidad de recursos GPU puede limitar el tamaño, número y duración de los experimentos de fine-tuning.
* Se utilizarán datasets públicos o aquellos que puedan ser utilizados legalmente dentro del contexto académico.
* El proyecto se concentrará inicialmente en una o dos tareas geoespaciales.
* La arquitectura se diseñará para permitir extensibilidad, pero no se implementarán todas las posibles tareas soportadas por Prithvi.
* El uso de infraestructura cloud será considerado únicamente cuando aporte valor a la validación y sea viable según los recursos disponibles.
* La autenticación avanzada, facturación y mecanismos empresariales de multi-tenancy no forman parte del alcance principal.
* La arquitectura podrá ejecutarse inicialmente en un entorno controlado mediante contenedores antes de considerar escenarios de despliegue más complejos.

---

# 3. Alcance del proyecto

El proyecto comprende el diseño e implementación de un prototipo de arquitectura MLOps para gestionar el ciclo de vida de modelos geoespaciales basados en Prithvi.

## Incluye

### Gestión de datasets

* Registro de datasets utilizados en los experimentos.
* Identificación de versiones.
* Asociación entre datasets y tareas geoespaciales.
* Registro de metadatos relevantes para reproducibilidad.
* Organización del flujo de datos requerido para entrenamiento y evaluación.

### Fine-tuning

* Integración de Prithvi-EO-2.0.
* Utilización de TerraTorch para procesos de adaptación.
* Configuración reproducible de experimentos.
* Ejecución de procesos de entrenamiento y validación.

### Experiment tracking

* Registro de parámetros.
* Registro de métricas.
* Registro de artefactos.
* Asociación entre experimentos y versiones de modelos.

### Model Registry

* Registro de modelos entrenados.
* Versionamiento de modelos.
* Asociación de modelos con sus métricas y experimentos.
* Definición de estados o criterios de promoción.

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

### API

* Desarrollo de una API REST para consumir los modelos desplegados.
* Endpoint o endpoints asociados a las tareas seleccionadas.
* Consulta de información básica sobre modelos y versiones.
* Documentación de la API.

### Validación

* Evaluación de reproducibilidad.
* Evaluación del funcionamiento del pipeline.
* Comparación de resultados de diferentes versiones.
* Medición de tiempos relevantes del flujo.
* Validación de la extensibilidad mediante más de una tarea geoespacial, cuando los recursos disponibles lo permitan.

## No incluye

* Construcción de un nuevo foundation model desde cero.
* Preentrenamiento de Prithvi.
* Implementación de todas las tareas geoespaciales disponibles.
* Plataforma comercial de inteligencia artificial geoespacial.
* Sistema de facturación real.
* Multi-tenancy empresarial.
* Sistema avanzado de autenticación y autorización.
* Garantías de disponibilidad propias de sistemas productivos.
* Despliegue obligatorio en múltiples proveedores cloud.
* Construcción de un cluster GPU propio.
* Desarrollo de una aplicación móvil o frontend complejo.
* Operación y mantenimiento posterior a la finalización del proyecto.

El resultado esperado corresponde a un **prototipo funcional y validado de una arquitectura MLOps**, no a una plataforma comercial lista para producción a gran escala.

---

# 4. Objetivos

## 4.1 Objetivo general

**Diseñar e implementar una arquitectura MLOps reproducible para gestionar el ciclo de vida de modelos geoespaciales basados en Prithvi, integrando la gestión de datasets, fine-tuning, evaluación, versionamiento, registro, despliegue y exposición mediante servicios API.**

## 4.2 Objetivos específicos

1. **Diseñar** una arquitectura modular que integre los componentes necesarios para gestionar el ciclo de vida de modelos geoespaciales basados en Prithvi.

2. **Implementar** un flujo reproducible para la gestión y versionamiento de datasets utilizados en procesos de fine-tuning.

3. **Integrar** TerraTorch en un pipeline de entrenamiento que permita ejecutar y registrar experimentos de adaptación de Prithvi para las tareas geoespaciales seleccionadas.

4. **Implementar** mecanismos de seguimiento y registro de experimentos, métricas y versiones de modelos mediante una plataforma de experiment tracking y model registry.

5. **Automatizar** la evaluación de modelos y establecer criterios verificables para determinar qué versiones pueden avanzar hacia la etapa de despliegue.

6. **Desarrollar** servicios de inferencia y una API REST que permitan consumir los modelos seleccionados desde aplicaciones externas.

7. **Evaluar** la arquitectura mediante indicadores de reproducibilidad, automatización, desempeño y extensibilidad utilizando al menos una tarea geoespacial principal y, cuando sea viable, una segunda tarea para validar la reutilización de la infraestructura.

---

# 5. Solución propuesta

La solución propuesta, denominada provisionalmente **GeoPrithvi MLOps**, consistirá en una arquitectura modular orientada a gestionar el ciclo de vida de modelos geoespaciales basados en Prithvi.

La arquitectura se organizará en diferentes componentes:

```text
                         ┌─────────────────────┐
                         │     API Gateway     │
                         │      REST API       │
                         └──────────┬──────────┘
                                    │
                         ┌──────────┴──────────┐
                         │                     │
                  Flood Service         Burn Scar Service
                         │                     │
                    Prithvi-F             Prithvi-B
                         │                     │
                         └──────────┬──────────┘
                                    │
                              Model Registry
                                 MLflow
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
              Model Versions                    Metrics
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                              MLOps Pipeline
                                    │
                              Orchestrator
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

El flujo comenzará con la incorporación de un dataset asociado a una tarea específica. El dataset deberá disponer de información suficiente para identificar su versión y sus características principales. Posteriormente, un proceso de entrenamiento ejecutará el fine-tuning de Prithvi mediante TerraTorch.

Durante el entrenamiento se registrarán parámetros, métricas y artefactos. Una vez finalizado el proceso, el modelo será evaluado mediante métricas apropiadas para la tarea. Los resultados determinarán si el modelo cumple con los criterios establecidos para ser registrado y potencialmente promovido.

MLflow será utilizado como componente de experiment tracking y model registry. Su Model Registry permite mantener diferentes versiones de un modelo, registrar metadatos y mantener información de procedencia asociada a los experimentos.

Los modelos que cumplan los criterios definidos podrán ser empaquetados y desplegados como servicios de inferencia. Finalmente, la API permitirá que un consumidor externo envíe una solicitud y reciba la predicción correspondiente.

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
REST API
```

Una característica fundamental de la propuesta será la separación entre los componentes específicos de cada tarea y los componentes generales de infraestructura. De esta manera, un servicio destinado a detección de inundaciones podrá utilizar el mismo pipeline MLOps que otro destinado a detección de cicatrices de incendios, cambiando principalmente el dataset, configuración, modelo adaptado y métricas específicas.

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

| Solución / enfoque     | Fine-tuning | Experiment tracking | Model registry |      Deployment |                         API | Multi-tarea |
| ---------------------- | ----------: | ------------------: | -------------: | --------------: | --------------------------: | ----------: |
| Prithvi-EO-2.0         |          Sí |   Parcial / externo |        Externo |         Posible |                     Externa |          Sí |
| TerraTorch             |          Sí |          Integrable |        Externo |      Integrable | No es su objetivo principal |          Sí |
| MLflow                 |          No |                  Sí |             Sí | Sí / integrable |                  Integrable |     General |
| Arquitectura propuesta |          Sí |                  Sí |             Sí |              Sí |                          Sí |          Sí |

La comparación evidencia que las herramientas existentes cubren diferentes componentes del ciclo de vida. Prithvi proporciona el foundation model y recursos para diferentes tareas; TerraTorch facilita el fine-tuning; y MLflow proporciona capacidades de tracking y model registry.

Por tanto, el aporte planteado no consiste en reemplazar estas tecnologías, sino en **integrarlas dentro de una arquitectura MLOps reproducible orientada específicamente al ciclo de vida de modelos geoespaciales basados en Prithvi**.

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

### Iteración 1 — Análisis y definición arquitectónica

**Propósito:** establecer los requerimientos, límites y arquitectura inicial.

Actividades:

* Revisión de literatura.
* Revisión de Prithvi-EO-2.0.
* Revisión de TerraTorch.
* Revisión de herramientas MLOps.
* Selección de tareas geoespaciales.
* Identificación de datasets.
* Definición de requisitos funcionales y no funcionales.
* Diseño inicial de la arquitectura.

**Resultado esperado:**

* Requerimientos.
* Arquitectura inicial.
* Selección tecnológica.
* Dataset y tareas seleccionadas.

---

### Iteración 2 — Preparación de datos y fine-tuning

**Propósito:** implementar el flujo básico de entrenamiento.

Actividades:

* Preparación del dataset.
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

### Iteración 3 — Experiment tracking y Model Registry

**Propósito:** integrar mecanismos de trazabilidad y gestión de versiones.

Actividades:

* Configuración de MLflow.
* Registro de experimentos.
* Registro de métricas.
* Registro de artefactos.
* Registro de modelos.
* Definición de metadata.
* Gestión de versiones.

**Resultado esperado:**

* Experimentos trazables.
* Modelos versionados.
* Relación entre dataset, experimento y modelo.

---

### Iteración 4 — Evaluación y automatización

**Propósito:** automatizar la evaluación y definir criterios de promoción.

Actividades:

* Definición de métricas.
* Implementación de evaluación automática.
* Definición de thresholds.
* Validación de modelos.
* Automatización de la promoción de modelos que cumplan los criterios.

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

### Iteración 5 — Deployment y API

**Propósito:** transformar el modelo registrado en un servicio consumible.

Actividades:

* Empaquetado del modelo.
* Construcción del servicio de inferencia.
* Contenerización.
* Desarrollo de API REST.
* Integración con el Model Registry.
* Pruebas de inferencia.
* Documentación de endpoints.

**Resultado esperado:**

* Modelo desplegado.
* Servicio de inferencia.
* API funcional.

---

### Iteración 6 — Extensión y validación final

**Propósito:** demostrar la reutilización de la arquitectura.

Actividades:

* Incorporación de una segunda tarea geoespacial, si los recursos disponibles lo permiten.
* Reutilización de componentes existentes.
* Comparación de resultados.
* Pruebas de reproducibilidad.
* Evaluación de desempeño.
* Documentación final.

**Resultado esperado:**

* Evidencia de extensibilidad.
* Resultados experimentales.
* Evaluación final de la arquitectura.

---

## 7.3 Estrategia de validación

La validación se realizará desde cuatro perspectivas.

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

### Validación de reproducibilidad

Se intentará repetir un experimento utilizando la misma versión de dataset, configuración y código, verificando que el proceso pueda reconstruirse y que los resultados se encuentren correctamente asociados a los artefactos correspondientes.

### Validación de desempeño

Se medirán indicadores como:

* Métricas específicas de la tarea.
* Tiempo de entrenamiento.
* Tiempo de inferencia.
* Tiempo de ejecución del pipeline.
* Uso de recursos computacionales, cuando sea posible.

Las métricas de desempeño del modelo dependerán de la tarea seleccionada. Para tareas de segmentación se podrán considerar métricas como IoU, mIoU, F1, precision y recall.

### Validación de extensibilidad

Se buscará demostrar que la incorporación de una segunda tarea no requiere modificar los componentes centrales de la arquitectura. Esto permitirá evaluar si la infraestructura diseñada realmente puede funcionar como una arquitectura reutilizable.

---

## 7.4 Plan de trabajo, cronograma e hitos

Considerando un periodo aproximado de tres meses, se propone el siguiente cronograma inicial:

| Fase              | Semanas | Actividades principales                     | Entregable                    |
| ----------------- | ------: | ------------------------------------------- | ----------------------------- |
| 1. Investigación  |     1–2 | Estado del arte, Prithvi, TerraTorch, MLOps | Marco conceptual y requisitos |
| 2. Arquitectura   |     2–3 | Diseño de componentes y flujo MLOps         | Arquitectura inicial          |
| 3. Datos          |     3–4 | Selección, preparación y versionamiento     | Dataset preparado             |
| 4. Fine-tuning    |     4–6 | Configuración y ejecución de entrenamiento  | Primer modelo                 |
| 5. Tracking       |     6–7 | MLflow y experiment tracking                | Experimentos registrados      |
| 6. Model Registry |     7–8 | Versionamiento y gestión de modelos         | Model Registry funcional      |
| 7. Automatización |     8–9 | Evaluación y criterios de promoción         | Pipeline automatizado         |
| 8. Deployment     |    9–10 | Contenedores y servicio de inferencia       | Model service                 |
| 9. API            |   10–11 | REST API e integración                      | API funcional                 |
| 10. Validación    |   11–12 | Pruebas, métricas y segunda tarea           | Resultados                    |
| 11. Documentación |      12 | Análisis y documentación final              | Informe final                 |

El cronograma podrá modificarse de acuerdo con la disponibilidad de infraestructura computacional, resultados obtenidos durante los experimentos y retroalimentación del mentor.

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
