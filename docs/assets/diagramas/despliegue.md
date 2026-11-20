# Diagrama de despliegue — Tune (Docker Compose local)

Entorno previsto: máquina del equipo o Virtual Machine (VM) con Docker. Sin autenticación ni
Hypertext Transfer Protocol Secure (HTTPS) público obligatorio. En VM pública se recomienda `API_BIND=127.0.0.1`.

```mermaid
flowchart TB
  subgraph Host["Host / VM"]
    subgraph Compose["docker compose"]
      WEB["tune-web<br/>nginx<br/>host :8080 → 80"]
      API["tune-eo-api<br/>uvicorn FastAPI<br/>host :8000 → 8000"]
    end
    VOL_HF[("volumen hf-cache<br/>pesos HF ~1,2 GB")]
    DIR_ART[("bind ./artifacts<br/>análisis + cachés")]
    ENV[".env / .env.example<br/>TUNE_OBSERVE_GFM<br/>VITE_MAPBOX_TOKEN"]
  end

  Op[Operador navegador] -->|"http://localhost:8080"| WEB
  WEB -->|"proxy /api"| API
  Op -.->|"opcional Swagger"| API
  API --- VOL_HF
  API --- DIR_ART
  ENV -.-> WEB
  ENV -.-> API
  API -->|"HTTPS salida"| NET["Internet:<br/>HF · Earth Search · JRC · EODC/GFM · WorldCover"]
```
