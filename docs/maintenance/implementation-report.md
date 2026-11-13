# Informe de implementación — `feature/tune-stabilization-map`

**Fecha:** 2026-11-13  
**Base:** `main` @ `785a6b6`  
**Rama:** `feature/tune-stabilization-map`  
**Respaldo lab:** `origin/backup/mlops-finetuning-lab` (`b7eec22`) verificado antes de decidir conservar `lab/`

---

## 1. Resumen de cambios

- Auditoría del repositorio (`docs/maintenance/audit.md`).
- Mapa interactivo (Leaflet + React Leaflet + teselas OSM) integrado en el flujo Antes/Después.
- Confirmación de ubicación → mismas coordenadas / `side_km` que alimentan STAC.
- Higiene: `web/tsconfig.tsbuildinfo` fuera de Git; extra `inference` documentado.
- Laboratorio MLOps **conservado** (académico); no se eliminó código de training/stages.
- Pruebas nuevas (AOI, geocode, errores STAC) y suite automatizada reejecutada donde el entorno lo permitió.

## 2. Archivos eliminados del seguimiento (no del disco de build)

| Archivo | Justificación |
|---|---|
| `web/tsconfig.tsbuildinfo` | Artefacto de `tsc -b`; no es fuente |

No se eliminó `lab/` ni módulos de stages/MLflow: son académicos y el respaldo existe, pero retirar el código del árbol rompería CLI/tests de lab sin beneficio inmediato para el mapa.

## 3. Archivos modificados / añadidos (principales)

| Ruta | Cambio |
|---|---|
| `docs/maintenance/audit.md` | Auditoría clasificada |
| `docs/maintenance/implementation-report.md` | Este informe |
| `pyproject.toml` | Extra `inference`; `training` duplicado por compatibilidad |
| `.gitignore`, `web/.gitignore` | Ignorar tsbuildinfo / dist |
| `Makefile`, `README.md` | Extra `inference` y mención del mapa |
| `web/package.json` (+ lock) | `leaflet`, `react-leaflet`, `@types/leaflet` |
| `web/src/lib/aoi.ts` (+ test) | Bbox alineado con backend |
| `web/src/components/home/LocationMap.tsx` | Mapa clic / AOI / recorte |
| `web/src/components/home/CompareFloodCatalog.tsx` | Integración mapa + confirmación |
| `web/src/styles.css` | Estilos del mapa |
| `web/src/components/docs/DocsScreen.tsx` | Instrucciones de mapa |
| `tests/unit/test_stac_catalog.py` | Bbox + error de cliente |
| `tests/integration/test_api_analyses.py` | Geocode + STAC 503 + coords |

## 4. Nuevas dependencias

**Frontend:** `leaflet@1.9`, `react-leaflet@5`, `@types/leaflet`  
**Teselas:** OpenStreetMap (`tile.openstreetmap.org`) — sin API key; atribución en el control Leaflet.  
**Backend Python:** ninguna librería nueva; extra `inference` = mismo conjunto que `training`.

## 5. Decisiones arquitectónicas

1. **Leaflet** frente a MapLibre: AOI rectangular + clic basta; menor complejidad y sin estilo vectorial propio.
2. **Confirmar ubicación** separa borrador de punto activo para STAC (evita búsquedas al arrastrar/clics accidentales).
3. **Misma fórmula `bbox_from_point`** en `web/src/lib/aoi.ts` y `stac.py`.
4. **No retirar lab** en esta rama: conservadurismo académico (audit §13).
5. **No marketplace / upload de modelos**; se mantiene `HazardSegmenter` como puerto.
6. **Burn Scars** sigue en API/CLI; UI permanece flood-only.
7. Extra **`inference`** aclara que TerraTorch/PyTorch son runtime de Prithvi, no solo fine-tune.

## 6. Funcionalidades implementadas

- Buscar lugar / coords / presets (existente) + mapa.
- Zoom, clic, lat/lon, rectángulo AOI, slider de recorte ≤ `max_side_km`.
- Confirmar → `onPlace` → búsqueda STAC Antes/Después.
- Mensajes vacíos / errores de catálogo sin bloquear la UI.
- Textos: agua detectada ≠ inundación definitiva (copy en filtros).

## 7. Pruebas ejecutadas y resultados

| Suite | Resultado |
|---|---|
| Vitest (`npm run test`) | **21 passed** |
| TypeScript (`npm run typecheck`) | **OK** |
| Vite build (`npm run build`) | **OK** (aviso de chunk >500 kB por Leaflet) |
| Pytest `-m "not gpu"` | **152 passed** |
| Ruff check `src` `tests` | **OK** (tras fix ASCII en test geocode) |

## 8. Pruebas que no pudieron ejecutarse

| Prueba | Motivo |
|---|---|
| Inferencia real Prithvi / TerraTorch | Entorno local: Python 3.14 sin `torch`/`terratorch` instalados; no se afirmó validación real de inferencia |
| `docker compose config` / build | `docker` no está en PATH en esta máquina |
| GPU / `@pytest.mark.gpu` | Sin GPU/runtime de training en el host |
| STAC / Nominatim / JRC / GFM reales de extremo a extremo | No se forzó red externa en CI local; hay mocks en integración |
| Escenas de evaluación piloto end-to-end | Requiere API levantada + pesos HF (~1,2 GB); procedimiento sigue en `docs/validation/` y `make validate-sites` |

## 9. Problemas encontrados y soluciones

- Literal `bytes` con “á” en test de geocode → SyntaxError; se usó ASCII.
- Extra self-referencial `tune[inference]` evitado: listas duplicadas `inference`/`training` por compatibilidad setuptools/Docker.
- Leaflet marker default (assets PNG) → `divIcon` minimal alineado al UI de Tune.

## 10. Limitaciones conocidas

- AOI solo rectangular centrado (no polígonos arbitrarios).
- Teselas OSM sujetas a política de uso de OpenStreetMap (uso educativo / tráfico moderado).
- Un análisis a la vez (semáforo existente en API).
- Máscara de agua ≠ prueba jurídica de inundación; el cambio depende de referencia (historial/JRC).
- Bundle web crece ~Leaflet; aceptable frente a MapLibre + estilo.

## 11. Instrucciones para ejecutar Tune

```bash
cp .env.example .env
make app-up      # API + web (Docker)
# Web http://localhost:8080  ·  API http://localhost:8000/docs
```

Frontend en desarrollo:

```bash
cd web && npm install && npm run dev
```

Deps Python (API + Prithvi cuando el Python sea compatible, p. ej. 3.11):

```bash
pip install -e ".[api,inference,dev]"
```

## 12. Recomendaciones para futuras versiones

1. Imagen Docker “solo producto” sin copiar `lab/scripts` si se retira el lab del runtime.
2. PR dedicado para archivar stages/MLflow tras mover consumidores a la rama backup.
3. Code-split del mapa (`React.lazy`) para reducir el chunk inicial.
4. Ejecutar y registrar las escenas de `docs/validation/` en un entorno con pesos cacheados.
5. Mantener `HazardSegmenter` si se añade un segundo modelo **curado** (no upload arbitrario).

---

**Estado de la rama:** lista para revisión. `main` no fue modificada. No se abrió ni fusionó un Pull Request.
