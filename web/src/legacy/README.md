# UI heredada (no montada)

`main.tsx` solo monta `MapApp`. El resto de la SPA anterior sigue en el árbol
por si hace falta recuperar subida GeoTIFF, timeline API o docs embebidas.

## Qué no entra en producción

| Ruta | Rol antiguo |
|---|---|
| `../router/AppRouter.tsx`, `../App.tsx` | Rutas `/`, `/analysis`, `/history`, `/docs`, `/howto` |
| `../pages/*` | Páginas del router |
| `../components/home/*` | HomeScreen, CompareFloodCatalog, LocationMap |
| `../components/analysis/*` | SceneStage, StatsCard, Timeline, PairCompare |
| `../components/howto/*`, `../components/docs/*` | Manuales in-app |
| `../components/history/*` | Lista de análisis vía API |

## Capacidad que sí vive en el backend

Historial persistente (`GET /api/analyses`), fusión GFM y upload GeoTIFF siguen
en la API. MapApp ya muestra GFM (IoU + capa Acuerdo) cuando el análisis trae
`fusion` / `fusion_png`.
