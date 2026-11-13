import type { Analysis } from "../types";
import { aoiSideKm, boundsOverlap, type Aoi } from "./aoi";
import { dateKey } from "./sceneRank";

/**
 * Reutiliza un análisis del historial solo si la equivalencia es verificable:
 * misma fecha de adquisición, mismo territorio (bounds) y escala de AOI similar.
 * No basta con la fecha sola (evita mezclar recortes distintos).
 */
export function findCompatibleAnalysis(
  history: Analysis[] | null | undefined,
  opts: {
    date: string | null;
    aoi: Aoi;
    sceneId?: string | null;
    sideTolKm?: number;
  },
): Analysis | null {
  if (!history || !opts.date) return null;
  const side = aoiSideKm(opts.aoi);
  const tol = opts.sideTolKm ?? 1.5;
  const sceneNeedle = opts.sceneId?.slice(-8);

  for (const a of history) {
    if (a.task !== "flood") continue;
    if (dateKey(a.acquired_at) !== opts.date) continue;

    if (sceneNeedle && a.input_filename.includes(sceneNeedle)) {
      if (a.bounds && boundsOverlap(a.bounds, opts.aoi.bbox, 0.45)) return a;
    }

    if (!a.bounds) continue;
    if (!boundsOverlap(a.bounds, opts.aoi.bbox, 0.5)) continue;

    const bw = a.bounds.east - a.bounds.west;
    const bh = a.bounds.north - a.bounds.south;
    const midLat = (a.bounds.south + a.bounds.north) / 2;
    const heightKm = bh * 110.57;
    const widthKm = bw * 111.32 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
    const histSide = Math.max(heightKm, widthKm);
    if (Math.abs(histSide - side) > tol) continue;
    return a;
  }
  return null;
}
