import type { CatalogScene } from "../types";
import { coverageRatio, type BBox } from "./aoi";

export type RankedScene = CatalogScene & {
  coverage: number;
  score: number;
  reasons: string[];
};

/**
 * Puntuación determinista y explicable (metadatos STAC, no LLM).
 * score = cobertura*0.55 + (1 - nubes/100)*0.35 + frescura_en_rango*0.10
 */
export function rankScenes(
  scenes: CatalogScene[],
  aoi: BBox,
  maxCloud: number,
): RankedScene[] {
  return scenes
    .map((s) => {
      const coverage = coverageRatio(aoi, s.bbox);
      const cloudScore = Math.max(0, 1 - s.cloud_cover / Math.max(1, maxCloud));
      const reasons: string[] = [];
      if (coverage >= 0.95) reasons.push("cubre casi todo el área");
      else if (coverage >= 0.5) reasons.push(`cubre ~${Math.round(coverage * 100)}% del área`);
      else reasons.push(`cobertura baja (~${Math.round(coverage * 100)}%)`);
      reasons.push(`${s.cloud_cover.toFixed(0)}% nubes (escena completa)`);
      const score = coverage * 0.55 + cloudScore * 0.35 + 0.1;
      return { ...s, coverage, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.cloud_cover - b.cloud_cover);
}

export function pickBestPair(
  before: RankedScene[],
  after: RankedScene[],
): { before: RankedScene | null; after: RankedScene | null } {
  const b = before.find((s) => s.coverage >= 0.35) ?? before[0] ?? null;
  const a = after.find((s) => s.coverage >= 0.35) ?? after[0] ?? null;
  if (b && a) {
    const bd = b.datetime.slice(0, 10);
    const ad = a.datetime.slice(0, 10);
    if (ad <= bd) {
      const later = after.find((s) => s.datetime.slice(0, 10) > bd) ?? null;
      return { before: b, after: later };
    }
  }
  return { before: b, after: a };
}

export function dateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
