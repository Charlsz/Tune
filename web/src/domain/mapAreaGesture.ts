import { normalizeBbox, validateAoiBbox, type BBox } from "./aoi";

/** Resultado de soltar el ratón tras un gesto de dibujo. */
export type DrawMouseUpResult =
  | { kind: "commit"; bbox: BBox; label: "Área dibujada" }
  | { kind: "reject"; error: string; draft: BBox | null };

/**
 * Interpreta el rectángulo dibujado (mousedown→mouseup).
 * El bbox commitado es exactamente el trazo normalizado (W/S/E/N), sin expandir a 35 km.
 */
export function resolveDrawMouseUp(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  maxSideKm = 150,
): DrawMouseUpResult {
  const raw: BBox = [start.lng, start.lat, end.lng, end.lat];
  const valid = validateAoiBbox(raw, maxSideKm);
  if (valid.ok) {
    return { kind: "commit", bbox: valid.bbox, label: "Área dibujada" };
  }
  return {
    kind: "reject",
    error: valid.error,
    draft: normalizeBbox(raw),
  };
}
