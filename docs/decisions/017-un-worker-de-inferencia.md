# ADR 017 — Un worker de inferencia por defecto (cola lista para crecer)

**Fecha:** 2026-11-04 · **Estado:** Aceptado · **Sigue a:** [ADR 005](./005-app-inferencia-checkpoints-publicados.md)

## Contexto

Tune usa Prithvi-EO para detectar agua. Ese modelo pesa alrededor de 1,2 GB en memoria.
Si dos o tres análisis corren al mismo tiempo en una máquina pequeña (laptop o VM de
estudiante con 4 u 8 GB de RAM), el proceso se queda sin memoria y se cae.

Hoy la API ya evita eso con un candado: solo un análisis a la vez. Si llega otro,
responde que hay uno en curso. Eso es seguro, pero para demos con varias personas
se siente a medias: la gente puede mirar la web, pero no todos pueden “analizar”
a la vez sin un mensaje de rechazo.

Queremos algo más parecido a un servicio real (aceptar varias peticiones) sin fingir
que una VM barata puede correr muchos modelos en paralelo.

## Decisión

1. **Por defecto: un solo worker de inferencia.**  
   Procesa los análisis de uno en uno. Es la opción segura en CPU y en VMs con
   poca RAM (las típicas del crédito Azure for Students).

2. **Diseño listo para más de uno.**  
   El número de workers debe ser configurable (por ejemplo una variable de entorno
   como `TUNE_INFER_WORKERS`). Si más adelante hay una máquina con 16 GB o una GPU
   con margen, se puede subir a 2 sin rediseñar todo.

3. **Cola delante del worker (evolución inmediata).**  
   Varias personas pueden pedir un análisis a la vez. Entran a una cola. El worker
   los atiende en orden. En la interfaz se ve algo como: en cola, procesando, listo.
   Así no dependemos del “inténtalo de nuevo” seco.

4. **Demos precargadas aparte.**  
   Los pares ya verificados (por ejemplo Sindh, Magdalena, Mississippi) deben poder
   abrirse sin volver a lanzar el modelo. Eso salva feria y jurado aunque la cola
   esté ocupada.

## Por qué un worker y no varios desde el día uno

| Idea | Qué pasa en la práctica |
|---|---|
| Abrir el candado a 3 análisis a la vez en una VM chica | Alto riesgo de quedarse sin memoria; la app se cae en plena demo |
| 2 workers en una máquina con poca RAM | Cada uno carga el modelo; se pelean por CPU; a veces todo va más lento que con uno solo |
| 1 worker + cola | Varias peticiones entran; el trabajo caro se hace en orden; la máquina aguanta |
| Varios workers cuando haya hardware | Tiene sentido con más RAM o GPU; es un ajuste de operación, no el diseño base |

En resumen: **concurrencia de peticiones sí; paralelismo del modelo solo si el hardware lo permite.**

## Alternativas descartadas (por ahora)

| Alternativa | Por qué no ahora |
|---|---|
| Varios workers fijos desde el inicio | Coste de memoria y riesgo en el hardware que tenemos para demos |
| Dejar solo el rechazo “hay un análisis en curso” | Funciona, pero no se siente a servicio listo para varias personas |
| Orquestadores grandes (Kubernetes, muchos nodos) | Fuera del plazo y del crédito; no hace falta para presentar |

## Consecuencias

- El comportamiento por defecto sigue alineado con el informe: un análisis pesado a la vez.
- Se puede explicar en jurado como arquitectura de sistemas: peticiones concurrentes,
  recurso caro serializado, posibilidad de subir workers cuando haya máquina.
- Publicar en Azure (VM pequeña) encaja con un worker. Si un día hay GPU o más RAM,
  se sube el número sin cambiar la idea.
- Hay que implementar (o completar) cola + estado visible en la UI; este ADR fija el
  criterio, no sustituye ese trabajo de código.
