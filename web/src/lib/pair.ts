import type { Analysis } from "../types";

/** Fecha de adquisición (YYYY-MM-DD) si existe. */
export function analysisDate(a: Analysis): string | null {
  const raw = a.acquired_at ?? null;
  if (!raw) return null;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * Dado un análisis «Después», busca el «Antes» en la lista del mismo lugar.
 * Preferencia: fechas de referencia del change; si no, la escena flood más reciente
 * con fecha estrictamente anterior.
 */
export function findBeforeMate(after: Analysis, list: Analysis[]): Analysis | null {
  if (after.task !== "flood") return null;
  const afterDay = analysisDate(after);
  const floods = list.filter((a) => a.task === "flood" && a.id !== after.id);

  const refDates = after.change?.reference_dates ?? [];
  for (let i = refDates.length - 1; i >= 0; i--) {
    const day = refDates[i]?.slice(0, 10);
    if (!day) continue;
    const hit = floods.find((a) => analysisDate(a) === day);
    if (hit) return hit;
  }

  if (!afterDay) return null;
  const earlier = floods
    .filter((a) => {
      const d = analysisDate(a);
      return d != null && d < afterDay;
    })
    .sort((a, b) => (analysisDate(b) ?? "").localeCompare(analysisDate(a) ?? ""));
  return earlier[0] ?? null;
}

export function findByDate(list: Analysis[], day: string): Analysis | null {
  return list.find((a) => a.task === "flood" && analysisDate(a) === day) ?? null;
}
