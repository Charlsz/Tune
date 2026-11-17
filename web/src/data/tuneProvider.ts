import { api } from "../api/client";
import { places as demoPlaces } from "./demo";
import {
  aoiFitsCatalogLimits,
  analysesToResult,
  catalogQueryFromAoi,
  catalogSceneToUi,
} from "./apiBridge";
import type { DataProvider, Scene } from "../domain/lab";

let maxSideKm = 30;

async function ensureLimits() {
  try {
    const limits = await api.catalogLimits();
    maxSideKm = limits.max_side_km;
  } catch {
    /* keep default */
  }
}

function dayWindow(date: string): { start: string; end: string } {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t)) return { start: date, end: date };
  const prev = new Date(t - 86400000).toISOString().slice(0, 10);
  const next = new Date(t + 86400000).toISOString().slice(0, 10);
  return { start: prev, end: next };
}

/** Proveedor real: catálogo STAC + analyze del API de Tune. */
export const tuneProvider: DataProvider = {
  places: demoPlaces,

  maskCells: () => [],

  async scenes(aoi, date) {
    await ensureLimits();
    if (!aoiFitsCatalogLimits(aoi, maxSideKm)) {
      throw new Error(
        `El área supera ${maxSideKm} km. Reduce el recorte e inténtalo de nuevo.`,
      );
    }
    const q = catalogQueryFromAoi(aoi, date, 40, maxSideKm);
    const { start, end } = dayWindow(date);
    const scenes = await api.catalogSearch({
      lat: q.lat,
      lon: q.lon,
      start,
      end,
      maxCloud: q.maxCloud,
      sideKm: q.sideKm,
    });
    return scenes.map(catalogSceneToUi);
  },

  async analyze(aoi, before, after) {
    await ensureLimits();
    if (!aoiFitsCatalogLimits(aoi, maxSideKm)) {
      throw new Error(
        `El área supera ${maxSideKm} km. Reduce el recorte e inténtalo de nuevo.`,
      );
    }
    const q = catalogQueryFromAoi(aoi, before.datetime.slice(0, 10), 40, maxSideKm);
    const place = { lat: q.lat, lon: q.lon };

    // Catálogo Sentinel-2 → siempre tarea flood → checkpoint Prithvi Sen1Floods11.
    const beforeAnalysis = await api.catalogAnalyze(
      before.id,
      "flood",
      place,
      q.sideKm,
      q.maxCloud,
    );
    const afterAnalysis = await api.catalogAnalyze(
      after.id,
      "flood",
      place,
      q.sideKm,
      q.maxCloud,
    );
    if (!afterAnalysis.model_id.includes("Prithvi")) {
      throw new Error(`Modelo inesperado: ${afterAnalysis.model_id}`);
    }

    return analysesToResult(aoi, before, after, beforeAnalysis, afterAnalysis);
  },
};

export function sceneImage(scene: Scene): string {
  return scene.image || scene.thumbnail || "";
}
