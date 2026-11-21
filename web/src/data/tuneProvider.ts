import { api } from "../api/client";
import { weekWindow } from "../domain/dateWindow";
import { places as demoPlaces } from "./demo";
import {
  aoiFitsCatalogLimits,
  analysesToResult,
  catalogQueryFromAoi,
  catalogSceneToUi,
} from "./apiBridge";
import type { AnalyzeProgressEvent, DataProvider, Scene } from "../domain/lab";

let maxSideKm = 30;

async function ensureLimits() {
  try {
    const limits = await api.catalogLimits();
    maxSideKm = limits.max_side_km;
  } catch {
    /* keep default */
  }
}

/** Orden de la semana: más antigua → más reciente. */
export function sortScenesByDate(scenes: Scene[]): Scene[] {
  return [...scenes].sort((a, b) =>
    (a.datetime || "").localeCompare(b.datetime || ""),
  );
}

function mapPhase(
  scene: AnalyzeProgressEvent["scene"],
  p: { phase: string; loaded?: number; total?: number; detail?: string },
): AnalyzeProgressEvent | null {
  if (p.phase === "prepare") {
    return { scene, phase: "prepare", detail: p.detail };
  }
  if (p.phase === "fetch") {
    return {
      scene,
      phase: "fetch",
      loaded: p.loaded,
      total: p.total,
      detail: p.detail,
    };
  }
  if (p.phase === "infer") {
    return { scene, phase: "infer", detail: p.detail };
  }
  return null;
}

/** Proveedor real: catálogo STAC + analyze del API de Tune. */
export const tuneProvider: DataProvider = {
  places: demoPlaces,

  maskCells: () => [],

  async scenes(aoi, date, maxCloud = 40) {
    await ensureLimits();
    if (!aoiFitsCatalogLimits(aoi, maxSideKm)) {
      throw new Error(
        `El área supera ${maxSideKm} km. Reduce el recorte e inténtalo de nuevo.`,
      );
    }
    const q = catalogQueryFromAoi(aoi, date, maxCloud, maxSideKm);
    const { start, end } = weekWindow(date);
    const scenes = await api.catalogSearch({
      lat: q.lat,
      lon: q.lon,
      start,
      end,
      maxCloud: q.maxCloud,
      sideKm: q.sideKm,
    });
    return sortScenesByDate(scenes.map(catalogSceneToUi));
  },

  async analyze(aoi, before, after, onProgress, maxCloud = 40) {
    await ensureLimits();
    if (!aoiFitsCatalogLimits(aoi, maxSideKm)) {
      throw new Error(
        `El área supera ${maxSideKm} km. Reduce el recorte e inténtalo de nuevo.`,
      );
    }
    const q = catalogQueryFromAoi(
      aoi,
      before.datetime.slice(0, 10),
      maxCloud,
      maxSideKm,
    );
    const place = { lat: q.lat, lon: q.lon };

    const run = async (
      scene: AnalyzeProgressEvent["scene"],
      id: string,
    ) => {
      onProgress?.({ scene, phase: "prepare", detail: "Preparando petición…" });
      return api.catalogAnalyze(
        id,
        "flood",
        place,
        q.sideKm,
        q.maxCloud,
        (p) => {
          const mapped = mapPhase(scene, p);
          if (mapped) onProgress?.(mapped);
        },
      );
    };

    const beforeAnalysis = await run("before", before.id);
    const afterAnalysis = await run("after", after.id);
    if (!afterAnalysis.model_id.includes("Prithvi")) {
      throw new Error(`Modelo inesperado: ${afterAnalysis.model_id}`);
    }

    return analysesToResult(aoi, before, after, beforeAnalysis, afterAnalysis);
  },
};

export function sceneImage(scene: Scene): string {
  return scene.image || scene.thumbnail || "";
}
