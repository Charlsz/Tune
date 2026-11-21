# Diagrama de secuencia — fusión GFM (capa o vacío)

Caso de uso: después de segmentar, Tune consulta Copernicus Global Flood
Monitoring (GFM) en una ventana de ±10 días. Si hay capa, calcula Intersection
over Union (IoU) y guarda `fusion.png`. Si el catálogo no devuelve ítem, el
análisis se guarda igual con `fusion = null` y HTTP 201.

```mermaid
sequenceDiagram
  participant API as eo-api
  participant UC as AnalyzeUseCase
  participant P as Prithvi
  participant G as GFM (EODC)
  participant D as artifacts/

  API->>UC: execute(flood)
  UC->>P: segment
  P-->>UC: máscara de agua
  UC->>G: observe ±10 días
  alt hay capa alineable
    G-->>UC: máscara externa
    UC->>UC: IoU y residuales
    UC->>D: analysis.json + fusion.png
    UC-->>API: fusion.iou numérico
    API-->>API: 201 con fusion
  else catálogo vacío o sin solape
    G-->>UC: vacío
    UC->>D: analysis.json sin fusion
    UC-->>API: fusion null, observation empty
    API-->>API: 201 sin tumbar el análisis
  end
```
