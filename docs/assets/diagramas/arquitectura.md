# Diagrama de arquitectura — Tune

Cliente-servidor en dos contenedores. MapApp (nginx :8080) habla con eo-api
(FastAPI :8000). El caso de uso orquesta Prithvi y proveedores externos detrás
de puertos: Joint Research Centre (JRC), Global Flood Monitoring (GFM),
WorldCover / Global Human Settlement Layer (GHSL), Earth Search
(SpatioTemporal Asset Catalog (STAC)). Persistencia en disco (`artifacts/`).

```mermaid
flowchart TB
  subgraph Cliente
    U[Operador]
    W["MapApp<br/>Vite/React + Leaflet<br/>:8080 nginx"]
  end

  subgraph Contenedor_API["Contenedor eo-api :8000"]
    API["FastAPI /api"]
    UC["AnalyzeUseCase"]
    SEG["PrithviSegmenter<br/>TerraTorch"]
    REF["ReferenceProvider<br/>historial → JRC (Joint Research Centre)"]
    OBS["ObservationProvider<br/>GFM (Global Flood Monitoring) ±10 d"]
    EXP["ExposureProvider<br/>WorldCover + GHSL"]
    CAT["SceneCatalog<br/>Earth Search L2A (STAC)"]
    REPO["AnalysisRepository<br/>filesystem"]
  end

  subgraph Externos
    HF[Hugging Face pesos]
    ES[Earth Search STAC]
    JRC["JRC GSW<br/>(Global Surface Water)"]
    GFM["EODC GFM<br/>(Earth Observation Data Centre)"]
    WC["WorldCover / GHSL<br/>(Global Human Settlement Layer)"]
  end

  subgraph Disco
    ART["artifacts/analyses/"]
    CACHE["volumen hf-cache"]
  end

  U --> W
  W -->|"HTTP /api"| API
  API --> UC
  API --> CAT
  UC --> SEG
  UC --> REF
  UC --> OBS
  UC --> EXP
  UC --> REPO
  CAT --> ES
  SEG --> HF
  SEG --> CACHE
  REF --> JRC
  REF --> ART
  OBS --> GFM
  EXP --> WC
  REPO --> ART
```
