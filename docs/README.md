# Documentación de Tune

Empieza por la **[Guía de uso](./GuiaDeUso.md)** si quieres saber qué hace la app, cómo levantarla, cómo probar escenas oficiales y cómo leer agua detectada vs inundación.

## Uso y operación

| Documento | Contenido |
|---|---|
| [GuiaDeUso.md](./GuiaDeUso.md) | Manual completo para usuarios y demos |
| [Instalación.md](./Instalación.md) | Requisitos, `make app-up` / logs / down, Windows |
| [Desarrollo.md](./Desarrollo.md) | Cómo desarrollar y dónde está cada pieza |
| [architecture/v2.md](./architecture/v2.md) | Arquitectura actual (puertos, inferencia, web) |

## Validación y evidencia

| Documento | Contenido |
|---|---|
| [validation/sitios.md](./validation/sitios.md) | Protocolo multi-sitio |
| [validation/jrc.md](./validation/jrc.md) | Referencia JRC / agua permanente |

## Informes del curso

| Documento | Contenido |
|---|---|
| [PrimerInforme.md](./PrimerInforme.md) | Planteamiento (**congelado**; no editar) |
| [SegundoInforme.md](./SegundoInforme.md) | Avance / segundo informe |
| [InformeFinal.md](./InformeFinal.md) | Plantilla del informe final |

## Decisiones de diseño

Carpeta [decisions/](./decisions/). El eje vigente de la app es [005 — inferencia con checkpoints publicados](./decisions/005-app-inferencia-checkpoints-publicados.md). Otras relevantes: [010 inundación como cambio](./decisions/010-inundacion-como-cambio.md), [014 fusión](./decisions/014-fusion-operativa.md), [015 exposición](./decisions/015-exposicion-global.md), [016 validación global](./decisions/016-validacion-global.md).

Notas del laboratorio de fine-tuning (secundario): [`lab/docs/`](../lab/docs/research/ComoProbar.md).
