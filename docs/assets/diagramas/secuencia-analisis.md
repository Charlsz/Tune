# Diagrama de secuencia — análisis Antes/Después (flujo MapApp)

Caso de uso representativo: el operador fija el Area of Interest (AOI) y dos fechas, elige escenas
Sentinel-2 y analiza. La segunda corrida usa la máscara previa como
`history_baseline` cuando aplica. Global Flood Monitoring (GFM) se consulta tras la segmentación; si no
hay ítem, el análisis sigue sin fusión.

```mermaid
sequenceDiagram
  actor Op as Operador
  participant UI as MapApp
  participant API as eo-api
  participant ES as Earth Search
  participant UC as AnalyzeUseCase
  participant P as Prithvi
  participant R as Historial/JRC
  participant G as GFM (EODC)
  participant X as WorldCover/GHSL
  participant D as artifacts/

  Op->>UI: Área + fechas Antes/Después
  UI->>API: GET /api/catalog/search (Antes)
  API->>ES: sentinel-2-l2a
  ES-->>API: escenas
  API-->>UI: lista
  UI->>API: GET /api/catalog/search (Después)
  API-->>UI: lista
  Op->>UI: Elegir escenas + Analizar

  UI->>API: POST /api/catalog/{idAntes}/analyze
  API->>ES: fetch 6 bandas
  API->>UC: execute(flood)
  UC->>P: segment
  P-->>UC: máscara W_antes
  UC->>R: reference
  R-->>UC: JRC (frío)
  UC->>G: observe ±10 d
  G-->>UC: capa o vacío
  UC->>X: expose
  UC->>D: analysis.json + png
  API-->>UI: Analysis Antes

  UI->>API: POST /api/catalog/{idDespues}/analyze
  API->>UC: execute(flood)
  UC->>P: segment
  P-->>UC: máscara W_pico
  UC->>R: reference
  R-->>UC: history_baseline ← Antes
  UC->>G: observe
  G-->>UC: capa o vacío
  UC->>X: expose
  UC->>D: change.png (+ fusion.png si hay)
  API-->>UI: Analysis Después
  UI-->>Op: Cambio / Acuerdo GFM / métricas
```
