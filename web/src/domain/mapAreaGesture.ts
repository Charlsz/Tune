import { normalizeBbox, validateAoiBbox, aoiFromPoint, type BBox } from "./aoi";

/** Resultado de soltar el ratón tras un gesto de dibujo. */
export type DrawMouseUpResult =
  | { kind: "commit"; bbox: BBox; label: "Área dibujada" }
  | { kind: "reject"; error: string; draft: BBox | null };

/** ¿El click de mapa puede crear AOI por punto? */
export function canSelectPointOnClick(opts: {
  drawing: boolean;
  step: string;
  suppressPointClick: boolean;
}): boolean {
  if (opts.suppressPointClick) return false;
  if (opts.drawing) return false;
  return opts.step === "area";
}

/** Interpreta el rectángulo dibujado (mousedown→mouseup). */
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

/** AOI fijo ~35 km al hacer click sin modo dibujar. */
export function pointSelectBbox(lat: number, lon: number): BBox {
  return aoiFromPoint({ lat, lon }, 35, 150).bbox;
}
