import type { Analysis, CatalogScene } from "../types";
import {
  aoiSideKm,
  bboxCenter,
  bboxDimensionsKm,
  type BBox,
} from "../domain/aoi";
import type { Cell, Result, ResultOverlays, Scene } from "../domain/lab";
import { selectionKey } from "../domain/lab";

/** Parámetros que entiende GET /api/catalog/search y POST /api/catalog/{id}/analyze. */
export interface CatalogQuery {
  lat: number;
  lon: number;
  start: string;
  end: string;
  sideKm: number;
  maxCloud: number;
}

/**
 * El backend busca por punto + lado (cuadrado). Un AOI rectangular se reduce
 * al centro y al lado mayor, igual que el flujo anterior de Tune.
 */
export function catalogQueryFromAoi(
  aoi: BBox,
  date: string,
  maxCloud = 40,
  maxSideKm = 50,
): CatalogQuery {
  const place = bboxCenter(aoi);
  const sideKm = Math.min(
    maxSideKm,
    Math.max(1, aoiSideKm({ mode: "rectangle", bbox: aoi })),
  );
  return {
    lat: place.lat,
    lon: place.lon,
    start: date,
    end: date,
    sideKm,
    maxCloud,
  };
}

/** Preview usable en el panel. */
export function catalogSceneToUi(scene: CatalogScene): Scene {
  return {
    ...scene,
    image: scene.thumbnail ?? "",
    water: [],
    demo: false,
  };
}

function boundsFromAnalysis(a: Analysis, fallback: BBox): BBox {
  if (!a.bounds) return [...fallback] as BBox;
  return [a.bounds.west, a.bounds.south, a.bounds.east, a.bounds.north];
}

/**
 * Resume un par Antes/Después del API al Resultado que espera el panel.
 * Incluye URLs de artefactos para el mapa.
 */
export function analysesToResult(
  aoi: BBox,
  before: Scene,
  after: Scene,
  beforeAnalysis: Analysis,
  afterAnalysis: Analysis,
): Result {
  const areaKm2 =
    afterAnalysis.change?.new_area_km2 ??
    afterAnalysis.affected_area_km2 ??
    0;
  const bounds = boundsFromAnalysis(afterAnalysis, aoi);
  const overlays: ResultOverlays = {
    bounds,
    beforePreview: beforeAnalysis.artifacts.preview_png,
    afterPreview: afterAnalysis.artifacts.preview_png,
    beforeMask: beforeAnalysis.artifacts.mask_png,
    afterMask: afterAnalysis.artifacts.mask_png,
    change: afterAnalysis.artifacts.change_png,
  };
  return {
    id: afterAnalysis.id,
    key: selectionKey(aoi, before, after),
    before: {
      ...before,
      image:
        beforeAnalysis.artifacts.preview_png ||
        before.image ||
        before.thumbnail ||
        "",
    },
    after: {
      ...after,
      image:
        afterAnalysis.artifacts.preview_png ||
        after.image ||
        after.thumbnail ||
        "",
    },
    cells: [] as Cell[],
    areaKm2: areaKm2 ?? 0,
    created: afterAnalysis.created_at,
    aoi: [...aoi] as BBox,
    overlays,
  };
}

/** Comprueba que el lado del AOI cabe en el tope del catálogo. */
export function aoiFitsCatalogLimits(aoi: BBox, maxSideKm: number): boolean {
  const { heightKm, widthKm } = bboxDimensionsKm(aoi);
  return Math.max(heightKm, widthKm) <= maxSideKm + 1e-6;
}
