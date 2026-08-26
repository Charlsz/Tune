# Arquitectura MLOps para el fine-tuning eficiente de modelos avanzados de inteligencia artificial

| | |
|---|---|
| **Proyecto** | **Tune** |
| **Autores** | Carlos Andrés Galvis Pájaro · Zenen Contreras Royero |
| **Programa** | Ingeniería de Sistemas y Computación |
| **Tutor** | Daniel Romero |
| **Documento** | Primer informe (alternativa) — replanteamiento del enfoque Terra → Tune |
| **Documento relacionado** | [PrimerInforme.md](./PrimerInforme.md) (versión original centrada en Prithvi / Terra) |

## Resumen / Abstract

Los modelos avanzados de inteligencia artificial son cada vez más grandes y costosos de adaptar. El fine-tuning exige preparar datos, configurar experimentos, entrenar, evaluar, versionar y, eventualmente, desplegar el modelo. Cuando estas etapas se ejecutan de forma manual y desconectada, el proceso se vuelve lento, difícil de reproducir y costoso en tiempo y recursos computacionales (GPU).

El presente proyecto, denominado **Tune**, propone diseñar e implementar una **arquitectura MLOps** orientada a **automatizar, registrar y comparar estrategias de fine-tuning**, de modo que sea posible medir —con evidencia experimental— si (y cuánto) una estrategia optimizada reduce tiempo, memoria o GPU-hours respecto a un baseline, manteniendo un desempeño comparable. Tune no pretende ser una plataforma comercial tipo SageMaker, sino un **laboratorio reproducible** de fine-tuning eficiente.

**Cambio de enfoque respecto a Terra.** La versión inicial del proyecto (**Terra**) se centraba en el ciclo de vida de modelos geoespaciales basados en **Prithvi**. Tras retroalimentación académica, se replantea el centro del aporte: la arquitectura MLOps y la comparación de estrategias de fine-tuning pasan a ser el núcleo; Prithvi (u otros modelos) quedan como **casos de estudio** para validar la arquitectura, no como dependencia crítica del proyecto.

El desarrollo se realizará mediante prototipado iterativo. El producto demostrable incluirá un pipeline automatizado, experimentos baseline vs optimizado, tracking/registry (p. ej. MLflow) y exposición del mejor modelo mediante API o CLI. Se espera responder, con métricas, a la pregunta: *¿podemos adaptar este modelo usando menos recursos sin perder significativamente calidad?*

---

# 0. Cambio de enfoque: de Terra a Tune

Esta sección documenta explícitamente la evolución del proyecto.

## 0.1 Enfoque original (Terra)

En el [Primer Informe original](./PrimerInforme.md), el proyecto se definió como:

> Arquitectura MLOps para el ciclo de vida y despliegue de modelos geoespaciales basados en **Prithvi**.

Características de ese enfoque:

* Dominio vertical: observación de la Tierra (EO).
* Backbone central: Prithvi-EO-2.0 + TerraTorch.
* Tarea ancla: Wildfire Scar Detection (HLS Burn Scars).
* Aporte principal: integrar datos → fine-tuning → tracking → registry → API de inferencia **alrededor de Prithvi**.

## 0.2 Motivo del cambio

Se identificaron limitaciones académicas y de riesgo:

1. **Dependencia excesiva de un ecosistema joven** (Prithvi / TerraTorch): si el tooling o los recursos GPU fallan, el proyecto entero queda frágil.
2. **Aporte demasiado acoplado a un modelo concreto**, frente a un problema más general y defendible: el costo y la dificultad de fine-tunear modelos avanzados de forma reproducible.
3. **Retroalimentación del tutor / dirección académica** hacia un enfoque de arquitectura MLOps para fine-tuning eficiente, no solo “hacer funcionar Prithvi”.

## 0.3 Enfoque propuesto (Tune)

| Aspecto | Terra (anterior) | Tune (propuesto) |
|---|---|---|
| Nombre | Terra | **Tune** |
| Centro del aporte | Ciclo de vida geoespacial + Prithvi | Laboratorio MLOps de fine-tuning eficiente |
| Rol de Prithvi | Eje del proyecto | Caso de estudio / modelo experimental (opcional pero deseable) |
| Pregunta guía | ¿Cómo integrar Prithvi en un flujo MLOps + API? | ¿Podemos fine-tunear con menos recursos sin perder casi calidad? |
| Producto visible | Pipeline + API de inferencia EO | Pipeline + comparación Baseline vs Optimized + modelo servible |
| Riesgo | Alto acoplamiento a EO/Prithvi | Menor: se puede cambiar el modelo de validación |

**Qué se conserva de Terra**

* Idea de arquitectura MLOps modular (datos, train, evaluate, register, deploy).
* Uso de experiment tracking y model registry (p. ej. MLflow).
* Exposición del modelo mediante API.
* Enfoque de prototipo académico (no plataforma comercial).
* Trabajo ya explorado sobre Prithvi como posible caso experimental.

**Qué cambia**

* El título y la narrativa dejan de ser “para Prithvi” y pasan a “para fine-tuning eficiente de modelos avanzados”.
* Se separan conceptualmente:
  * **Arquitectura MLOps** = infraestructura que ejecuta, registra y compara experimentos.
  * **Optimización de fine-tuning** = estrategias evaluadas (p. ej. full FT vs LoRA / mixed precision / early stopping).
* El entregable estrella de la demo es la **comparación experimental** (tiempo, memoria, GPU-hours, calidad), no solo “entrenamos Prithvi”.

## 0.4 Nombre: Tune

**Tune** alude directamente al *fine-tuning*: ajustar modelos de forma sistemática, comparable y eficiente. El nombre permanece válido si los casos de estudio cambian (Prithvi, modelos de lenguaje u otros), a diferencia de Terra, más ligado a observación de la Tierra.

---

# 1. Introducción

El crecimiento de los modelos fundacionales y de los modelos avanzados de IA ha desplazado gran parte del esfuerzo práctico hacia el **fine-tuning**: adaptar un modelo preentrenado a una tarea o dominio concreto. Ese proceso no es solo “correr un script de entrenamiento”. Incluye preparación y versionado de datos, configuración de hiperparámetros, ejecución bajo restricciones de GPU, registro de métricas, comparación entre corridas, selección de la mejor versión y, en muchos casos, exposición del modelo para inferencia.

En la práctica, equipos académicos y de ingeniería enfrentan dos fricciones recurrentes:

1. **Costo y duración del entrenamiento** (tiempo de wall-clock, memoria GPU, GPU-hours).
2. **Falta de reproducibilidad y comparabilidad** entre estrategias (¿qué configuración produjo qué resultado? ¿el ahorro de recursos sacrificó demasiado la calidad?).

Existen piezas sueltas que cubren partes del problema: frameworks de entrenamiento, técnicas de adaptación eficiente de parámetros (p. ej. LoRA / QLoRA), mixed precision, experiment tracking (MLflow) y model registries. Sin embargo, con frecuencia no hay una **arquitectura integrada y acotada** que permita, en un mismo flujo, ejecutar un baseline, ejecutar una estrategia optimizada, compararlas con métricas explícitas y dejar el modelo resultante disponible para consumo.

A partir de esta necesidad se propone **Tune**: un laboratorio MLOps —prototipo académico— para experimentar, comparar y optimizar el fine-tuning de modelos avanzados, demostrando con evidencia cuándo una estrategia permite entrenar de forma más eficiente. Los modelos concretos (incluido Prithvi, si se mantiene como caso) validan la arquitectura; no la definen por completo.

---

# 2. Planteamiento del problema

## 2.1 Descripción del problema

Fine-tunear un modelo avanzado implica coordinar datos, cómputo, configuración, evaluación y versionado. Cuando el proceso es manual o fragmentado:

* Es difícil saber qué combinación de dataset, código y parámetros originó un modelo.
* Comparar “entrenamiento estándar” vs “entrenamiento optimizado” se vuelve informal o no reproducible.
* El costo en tiempo y GPU puede volverse prohibitivo para iterar.
* El paso de “modelo entrenado” a “modelo usable” (API / servicio) suele quedar desconectado del experimento.

Los afectados son equipos de I+D, estudiantes e ingenieros que necesitan adaptar modelos sin contar con una plataforma enterprise completa.

El problema puede sintetizarse así:

> **El fine-tuning de modelos avanzados de IA tiende a ser costoso en tiempo y recursos, y difícil de reproducir y comparar entre estrategias, debido a la falta de una arquitectura MLOps integrada que automatice el ciclo de entrenamiento, registre evidencias y permita evaluar de forma controlada si una estrategia optimizada reduce recursos sin degradar significativamente la calidad del modelo.**

La oportunidad no es inventar un foundation model nuevo, sino **organizar y medir** el proceso de adaptación.

## 2.2 Justificación

* **Pertinencia técnica:** el fine-tuning eficiente (PEFT, precisión mixta, early stopping, etc.) es un tema activo; medirlo en un pipeline reproducible aporta evidencia concreta.
* **Pertinencia de ingeniería:** el proyecto integra arquitectura de software, datos, automatización, tracking, registry y servicios de inferencia.
* **Defendibilidad académica:** se separa la infraestructura (MLOps) de las técnicas evaluadas (optimización), evitando atribuir a “la arquitectura” lo que en realidad produce una técnica de entrenamiento.
* **Continuidad con Terra:** se reutiliza el aprendizaje y el esqueleto conceptual ya trabajados, reduciendo el costo de pivotar.
* **Riesgo controlado:** si un modelo experimental falla, se puede sustituir el caso de estudio sin redefinir todo el proyecto.

## 2.3 Restricciones y supuestos iniciales

* Carácter académico / prototipo; no plataforma comercial.
* GPU limitada: pocos experimentos, modelos y datasets acotados.
* Datasets públicos o de uso académico permitido.
* Mínimo viable experimental: **1 modelo + 1 dataset + 2 estrategias** (baseline vs optimizado). Un segundo modelo o dataset es extensión opcional.
* Prithvi puede usarse como caso, pero no es dependencia obligatoria del éxito del proyecto.
* No se construye un “Hugging Face / SageMaker” completo ni multi-tenancy / billing.
* La UI de demo, si existe, será mínima (laboratorio visual); el núcleo es pipeline + métricas + API/CLI.
* Kubernetes, multi-cloud y orquestación productiva quedan como trabajo futuro.

---

# 3. Alcance del proyecto

El proyecto comprende el diseño e implementación de un **prototipo de laboratorio MLOps (Tune)** para ejecutar, registrar, comparar y servir resultados de fine-tuning eficiente.

## Incluye

### Gestión de datasets

* Registro y versionado básico de datasets usados en experimentos.
* Metadatos necesarios para reproducibilidad.
* Asociación dataset ↔ experimento ↔ modelo.

### Motor de fine-tuning y estrategias

* Ejecución de al menos dos estrategias comparables, por ejemplo:
  * **Baseline:** fine-tuning estándar (full FT o configuración de referencia).
  * **Optimized:** estrategia eficiente (p. ej. LoRA / QLoRA, mixed precision, gradient accumulation, early stopping — según viabilidad).
* Configuraciones versionadas y repetibles.

### Experiment tracking y model registry

* Registro de parámetros, métricas, artefactos y tiempos/recursos.
* Versionado de modelos y estados de promoción (trained / evaluated / candidate / approved).
* MLflow (u equivalente) como columna de tracking/registry.

### Comparación experimental (núcleo del aporte medible)

* Tabla/gráfico Baseline vs Optimized con al menos:
  * tiempo de entrenamiento
  * memoria GPU (pico o promedio, según instrumentación)
  * GPU-hours (o proxy)
  * métrica(s) de calidad de la tarea
* Interpretación explícita: la arquitectura habilita la comparación; la estrategia explica el ahorro (si existe).

### Despliegue e inferencia

* Empaquetado del modelo seleccionado.
* API REST (o CLI + endpoint mínimo) para inferencia, incluyendo versión del modelo en la respuesta.

### Validación

* Reproducibilidad de al menos un experimento.
* Funcionamiento del pipeline extremo a extremo.
* Demo de comparación + consumo del modelo.

## No incluye

* Preentrenamiento de foundation models desde cero.
* Plataforma multi-usuario productiva, facturación o OAuth2 empresarial obligatorio.
* Optimización exhaustiva de todas las técnicas PEFT / distributed training.
* Frontend complejo o aplicación móvil.
* Garantías de SLA / alta disponibilidad.
* Obligación de usar exclusivamente Prithvi o dominio EO.

**Resultado esperado:** prototipo validado de laboratorio MLOps con evidencia experimental y modelo servible — no un producto comercial a escala.

---

# 4. Objetivos

## 4.1 Objetivo general

**Diseñar e implementar Tune, una arquitectura MLOps reproducible que automatice el ciclo de fine-tuning de modelos avanzados de IA, permita comparar estrategias (baseline vs optimizado) mediante métricas de tiempo, recursos y calidad, y entregue el modelo resultante como servicio de inferencia consumible.**

## 4.2 Objetivos específicos

1. **Diseñar** una arquitectura modular que separe infraestructura MLOps de estrategias de entrenamiento evaluables.
2. **Implementar** un flujo reproducible de datos → entrenamiento → evaluación → registro.
3. **Integrar** experiment tracking y model registry para trazabilidad entre dataset, run y versión de modelo.
4. **Definir e instrumentar** métricas de eficiencia (tiempo, memoria/GPU-hours) y de calidad.
5. **Ejecutar** al menos un par experimental Baseline vs Optimized bajo condiciones documentadas.
6. **Analizar** si la estrategia optimizada reduce recursos sin degradación significativa de calidad (o bajo qué condiciones no lo hace).
7. **Desplegar** el modelo seleccionado mediante API/CLI con metadatos de versión.
8. **Documentar** el cambio Terra → Tune y el rol de los casos de estudio (p. ej. Prithvi) como validadores, no como centro exclusivo.

---

# 5. Marco conceptual (1ra versión)

## 5.1 Fine-tuning

Adaptación de un modelo preentrenado a una tarea o dominio mediante entrenamiento adicional sobre un dataset etiquetado (o parcialmente etiquetado).

## 5.2 Estrategias de fine-tuning eficiente

Técnicas que buscan reducir costo computacional o memoria, por ejemplo:

* **PEFT (LoRA / QLoRA):** actualizar un subconjunto de parámetros o adaptadores.
* **Mixed precision:** entrenar con menor precisión numérica donde sea seguro.
* **Gradient accumulation, checkpointing, early stopping:** control de memoria y de duración.

Estas técnicas son **objeto de evaluación**, no sinónimo de la arquitectura Tune.

## 5.3 MLOps

Prácticas y componentes para gestionar el ciclo de vida de sistemas ML: datos, entrenamiento, evaluación, registro, despliegue y monitoreo. En Tune, MLOps es el **laboratorio** que hace posibles corridas comparables.

## 5.4 Experiment tracking y model registry

* **Tracking:** qué se ejecutó y con qué resultado.
* **Registry:** qué modelo está autorizado para usarse y en qué versión.

## 5.5 Baseline vs Optimized

* **Baseline:** estrategia de referencia (típicamente más costosa o “estándar”).
* **Optimized:** estrategia candidata a mayor eficiencia.
* La comparación debe reportar **calidad y costo**, no solo velocidad.

## 5.6 Inferencia como servicio

Exponer el modelo aprobado mediante API/CLI para demostrar el cierre del ciclo: del experimento al uso.

## 5.7 Relación conceptual

```text
Modelo + Dataset + Estrategia
            ↓
     Pipeline Tune (MLOps)
            ↓
   Tracking / Métricas / Artefactos
            ↓
     Comparación Baseline vs Optimized
            ↓
        Model Registry
            ↓
      API de inferencia
```

---

# 6. Solución propuesta

**Tune** es un laboratorio MLOps (prototipo) para fine-tuning eficiente.

```text
                         ┌─────────────────────┐
                         │  Demo / API / CLI   │
                         └──────────┬──────────┘
                                    │
                              Inference
                                    │
                              Model Registry
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
              Metrics & Compare              Model Versions
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                           Experiment Tracking
                                    │
                           Orchestrator / Pipeline
                                    │
              ┌─────────────────────┼─────────────────────┐
              ↓                     ↓                     ↓
         Dataset prep         Training Engine        Evaluation
                                   │
                    ┌──────────────┴──────────────┐
                    ↓                             ↓
              Baseline strategy            Optimized strategy
              (p.ej. Full FT)              (p.ej. LoRA + FP16)
```

### Experiencia demostrable (producto visible)

1. Elegir modelo + dataset + estrategia.
2. Ejecutar entrenamiento (pipeline).
3. Ver métricas de corrida.
4. Comparar Baseline vs Optimized.
5. Usar el modelo resultante (API).

### Separación defendible ante jurado

> La **arquitectura** permite ejecutar, registrar y comparar.  
> La **optimización** es la estrategia que se mide.  
> No se afirma “Tune hace el entrenamiento más rápido” sin señalar *qué técnica* y *bajo qué métricas*.

### Casos de estudio

* **Preferido inicial:** reutilizar el trabajo con Prithvi / tarea EO si sigue siendo viable (continuidad con Terra).
* **Respaldo:** otro modelo/dataset más estable o liviano si Prithvi bloquea el avance.
* Un segundo caso es opcional y solo se aborda si el mínimo experimental ya está cerrado.

### Flujo conceptual

```text
Dataset versionado
   ↓
Configuración (baseline | optimized)
   ↓
Fine-tuning
   ↓
Tracking (params, metrics, resources)
   ↓
Evaluation
   ↓
Compare runs
   ↓
Registry / promoción
   ↓
Inference API
   ↓
Demo
```

---

# 7. Estado del arte / soluciones relacionadas

## 7.1 Fine-tuning y adaptación eficiente

El fine-tuning completo de modelos grandes es costoso. Técnicas PEFT (LoRA, QLoRA) y entrenamiento en precisión mixta buscan reducir memoria y/o tiempo con degradación limitada de calidad. Su efectividad depende del modelo, la tarea y el hardware: por eso Tune insiste en **medir**, no asumir.

## 7.2 Herramientas de entrenamiento

Frameworks como PyTorch Lightning, Hugging Face Transformers/PEFT o TerraTorch (en dominio EO) facilitan entrenar, pero no sustituyen por sí solos un laboratorio de comparación + registry + inferencia integrado al alcance académico.

## 7.3 MLflow y prácticas MLOps

MLflow cubre tracking y model registry. La literatura MLOps enfatiza reproducibilidad, automatización y tránsito experimentación → operación. Tune se posiciona como **integración acotada** de esas prácticas aplicadas al problema del fine-tuning eficiente.

## 7.4 Comparación de cobertura

| Enfoque | Entrena | Compara estrategias | Tracking/Registry | API inferencia | Foco eficiencia medible |
|---|---:|---:|---:|---:|---:|
| Script manual de FT | Sí | No | Raro | No | No |
| TerraTorch / HF trainers | Sí | Parcial | Integrable | Externo | Parcial |
| MLflow solo | No | Parcial | Sí | Integrable | No |
| Plataformas cloud (SageMaker, etc.) | Sí | Sí | Sí | Sí | Sí (fuera de alcance) |
| **Tune (propuesto)** | Sí | **Sí (núcleo)** | Sí | Sí | **Sí (prototipo)** |

**Vacío que aborda Tune:** un prototipo académico que une pipeline MLOps + comparación explícita de eficiencia + modelo servible, sin pretender ser una plataforma comercial.

---

# 8. Metodología de desarrollo y plan de trabajo

## 8.1 Enfoque metodológico

**Prototipado iterativo** con resultados verificables por iteración:

```text
Diseño → Implementación → Integración → Prueba → Evaluación → Ajuste
```

Regla de prioridad:

1. Pipeline reproducible baseline.
2. Tracking + registry.
3. Segunda estrategia (optimized) + comparación.
4. API de inferencia.
5. Demo mínima (UI opcional).

## 8.2 Iteraciones

### Iteración 1 — Replanteamiento y arquitectura Tune

* Documentar cambio Terra → Tune (este informe).
* Acordar con el tutor: métricas de “más eficiente”, técnicas candidatas y modelos de prueba.
* Diseño de arquitectura y criterios Baseline vs Optimized.

### Iteración 2 — Datos + baseline reproducible

* Dataset versionado.
* Primer entrenamiento baseline registrado.

### Iteración 3 — Tracking y registry

* MLflow (o equivalente) operativo.
* Trazabilidad dataset ↔ run ↔ modelo.

### Iteración 4 — Estrategia optimizada + comparación

* Implementar estrategia optimized.
* Instrumentar tiempo / memoria / GPU-hours / calidad.
* Producir tabla y análisis Baseline vs Optimized.

### Iteración 5 — Evaluación, promoción y pipeline

* Criterios de promoción.
* Script/pipeline prepare → train → evaluate → register → compare.

### Iteración 6 — Inferencia y demo

* API/CLI de predicción.
* Demo de 3 minutos: historia “¿menos recursos, casi misma calidad?”.
* UI mínima solo si no compromete los experimentos.

### Iteración 7 — Validación y cierre

* Reproducibilidad.
* (Opcional) segundo caso de estudio.
* Informe final y discusión de resultados (incluyendo si la optimización *no* mejora).

## 8.3 Estrategia de validación

* **Funcional:** pipeline, tracking, registry, API.
* **Reproducibilidad:** repetir un run con mismos insumos.
* **Eficiencia:** Δ tiempo, Δ memoria, Δ GPU-hours.
* **Calidad:** Δ métrica de tarea dentro de umbral aceptable documentado.
* **Cierre de ciclo:** inferencia con versión registrada.

## 8.4 Cronograma resumido (orientativo)

| Fase | Semanas | Entregable |
| --- | ---: | --- |
| 1. Replanteamiento | 1 | Informe Tune + acuerdos con tutor |
| 2. Arquitectura | 1-2 | Diseño y métricas |
| 3. Baseline | 2-4 | Run baseline reproducible |
| 4. Tracking/Registry | 4-5 | Experimentos trazables |
| 5. Optimized + compare | 5-7 | Tabla Baseline vs Optimized |
| 6. Pipeline | 7-8 | Automatización E2E |
| 7. API + demo | 8-10 | Modelo servible + demo |
| 8. Validación y docs | 10-12 | Resultados e informe final |

---

# 9. Producto final presentable

Tune se presenta como **laboratorio reproducible**, no como “app para entrenar cualquier modelo”.

### Para público no técnico

> “Este modelo normalmente tarda X y usa Y de memoria. Con la estrategia optimizada tardó X′ y usó Y′, con calidad casi igual. El sistema guarda el experimento y deja el modelo usable por una API.”

### Para ingeniería

Detalle de modelo, dataset, hardware, PEFT vs full FT, instrumentación de GPU-hours, reproducibilidad, registry y orquestación.

### Piezas mínimas de la demo

1. Lanzar / mostrar dos runs (baseline y optimized).
2. Tabla o gráfico de comparación.
3. Inferencia con el modelo promovido.
4. (Opcional) vista simple de experiments.

---

# 10. Bibliografía inicial

[1] Szwarcman, D., Roy, S., Fraccaro, P., et al. *Prithvi-EO-2.0: A Versatile Multi-Temporal Foundation Model for Earth Observation Applications*. arXiv, 2024. *(caso de estudio heredado de Terra; opcional en Tune)*

[2] Hu, E. J., et al. *LoRA: Low-Rank Adaptation of Large Language Models*. arXiv, 2021.

[3] Dettmers, T., et al. *QLoRA: Efficient Finetuning of Quantized LLMs*. arXiv, 2023.

[4] Micikevicius, P., et al. *Mixed Precision Training*. ICLR, 2018.

[5] MLflow. *MLflow Tracking Documentation*.

[6] MLflow. *MLflow Model Registry Documentation*.

[7] Nogare, D., & Silveira, I. F. *Experimentation, deployment and monitoring Machine Learning models: Approaches for applying MLOps*. arXiv, 2024.

[8] Sculley, D., et al. *Hidden Technical Debt in Machine Learning Systems*. NeurIPS, 2015.

[9] IBM Research / TerraTorch. Documentación y toolkit de fine-tuning geoespacial. *(referencia de tooling si se conserva el caso Prithvi)*

[10] Proyecto Terra — [Primer Informe original](./PrimerInforme.md). Documento base del enfoque previo.

---

## Nota de uso de este documento

`PrimerInforme_alternativa.md` es la **propuesta de replanteamiento** hacia Tune. El [PrimerInforme.md](./PrimerInforme.md) conserva el enfoque Terra/Prithvi. La adopción formal de Tune queda sujeta a **confirmación con el tutor** (métricas de eficiencia, técnicas y modelos de prueba).
