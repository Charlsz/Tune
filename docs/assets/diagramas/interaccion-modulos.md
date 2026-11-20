# Diagrama de interacción entre módulos — Tune

Dependencias hacia adentro: `interfaces → application → domain ← infrastructure`.
La web no conoce TerraTorch ni Uniform Resource Locators (URLs) de tiles; solo el contrato `/api` (Application Programming Interface).

```mermaid
flowchart LR
  subgraph interfaces
    WEB[MapApp]
    API[analyses router]
    CLI[tune CLI]
  end

  subgraph application
    AN[analyze]
    CH[change]
    FU[fusion]
    EX[exposure]
  end

  subgraph domain
    ENT[Analysis / Change / Fusion / Exposure]
    PORTS[Puertos:<br/>HazardSegmenter<br/>ReferenceProvider<br/>ObservationProvider<br/>ExposureProvider<br/>SceneCatalog<br/>AnalysisRepository]
  end

  subgraph infrastructure
    PR[prithvi]
    STAC_O[observation/stac]
    STAC_C[catalog/stac]
    JRC[reference/jrc + history]
    WC[exposure]
    FS[analyses/filesystem]
    CTR[container.py]
  end

  WEB --> API
  CLI --> AN
  API --> AN
  AN --> CH
  AN --> FU
  AN --> EX
  AN --> ENT
  AN --> PORTS
  CTR --> PR & STAC_O & STAC_C & JRC & WC & FS
  PR & STAC_O & STAC_C & JRC & WC & FS -.->|implementan| PORTS
```
