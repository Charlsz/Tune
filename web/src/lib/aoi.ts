import type { Place } from "../types";

/** Bbox WGS84 [west, south, east, north]. */
export type BBox = [number, number, number, number];

export type AoiMode = "point" | "rectangle";

/** Área de interés canónica. El bbox mostrado es el que se envía al catálogo. */
export type Aoi =
  | {
      mode: "point";
      center: Place;
      sideKm: number;
      bbox: BBox;
      label?: string;
    }
  | {
      mode: "rectangle";
      bbox: BBox;
      label?: string;
    };

/** Bbox WGS84 centrado en el punto — misma fórmula que el backend. */
export function bboxFromPoint(
  lat: number,
  lon: number,
  sideKm: number,
): BBox {
  const dlat = sideKm / 2 / 110.57;
  const dlon = sideKm / 2 / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return [lon - dlon, lat - dlat, lon + dlon, lat + dlat];
}

export function clampSideKm(sideKm: number, maxSideKm: number): number {
  if (!Number.isFinite(sideKm)) return 1;
  return Math.min(maxSideKm, Math.max(1, sideKm));
}

export function formatPlaceCoords(place: Place, digits = 4): string {
  return `${place.lat.toFixed(digits)}, ${place.lon.toFixed(digits)}`;
}

export function parseCoords(raw: string): Place | null {
  const match = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/** Leaflet LatLngBoundsLiteral [[south, west], [north, east]]. */
export function bboxToLatLngBounds(
  bbox: BBox,
): [[number, number], [number, number]] {
  const [west, south, east, north] = bbox;
  return [
    [south, west],
    [north, east],
  ];
}

export function bboxCenter(bbox: BBox): Place {
  const [west, south, east, north] = bbox;
  return { lat: (south + north) / 2, lon: (west + east) / 2 };
}

/** Altura × ancho aproximados en km (fórmula plana; misma idea que el backend). */
export function bboxDimensionsKm(bbox: BBox): { heightKm: number; widthKm: number } {
  const [west, south, east, north] = bbox;
  const midLat = (south + north) / 2;
  const heightKm = (north - south) * 110.57;
  const widthKm = (east - west) * 111.32 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  return { heightKm, widthKm };
}

export function formatBbox(bbox: BBox, digits = 5): string {
  return bbox.map((n) => n.toFixed(digits)).join(",");
}

export function normalizeBbox(raw: BBox): BBox | null {
  const [a, b, c, d] = raw;
  const west = Math.min(a, c);
  const east = Math.max(a, c);
  const south = Math.min(b, d);
  const north = Math.max(b, d);
  if (east - west < 1e-8 || north - south < 1e-8) return null;
  if (south < -90 || north > 90 || west < -180 || east > 180) return null;
  return [west, south, east, north];
}

export function validateAoiBbox(
  bbox: BBox,
  maxSideKm: number,
): { ok: true; bbox: BBox } | { ok: false; error: string } {
  const normalized = normalizeBbox(bbox);
  if (!normalized) {
    return { ok: false, error: "Área inválida. Dibuja un rectángulo con tamaño usable." };
  }
  const { heightKm, widthKm } = bboxDimensionsKm(normalized);
  const side = Math.max(heightKm, widthKm);
  if (side > maxSideKm + 1e-6) {
    return {
      ok: false,
      error: `El área mide ~${side.toFixed(1)} km de lado; el máximo es ${maxSideKm} km.`,
    };
  }
  if (side < 0.2) {
    return { ok: false, error: "El área es demasiado pequeña. Arrastra un rectángulo más amplio." };
  }
  return { ok: true, bbox: normalized };
}

export function aoiFromPoint(
  center: Place,
  sideKm: number,
  maxSideKm: number,
  label?: string,
): Extract<Aoi, { mode: "point" }> {
  const side = clampSideKm(sideKm, maxSideKm);
  return {
    mode: "point",
    center,
    sideKm: side,
    bbox: bboxFromPoint(center.lat, center.lon, side),
    label,
  };
}

export function aoiFromRectangle(
  bbox: BBox,
  maxSideKm: number,
  label?: string,
): Extract<Aoi, { mode: "rectangle" }> | { error: string } {
  const checked = validateAoiBbox(bbox, maxSideKm);
  if (!checked.ok) return { error: checked.error };
  return { mode: "rectangle", bbox: checked.bbox, label };
}

export function aoiPlace(aoi: Aoi): Place {
  return aoi.mode === "point" ? aoi.center : bboxCenter(aoi.bbox);
}

export function aoiSideKm(aoi: Aoi): number {
  if (aoi.mode === "point") return aoi.sideKm;
  const { heightKm, widthKm } = bboxDimensionsKm(aoi.bbox);
  return Math.max(heightKm, widthKm);
}

export function aoiLabel(aoi: Aoi): string {
  if (aoi.label) return aoi.label;
  const p = aoiPlace(aoi);
  return formatPlaceCoords(p);
}

/** Fracción del AOI cubierta por el bbox de la escena (0–1). */
export function coverageRatio(aoi: BBox, scene: number[]): number {
  if (scene.length < 4) return 0;
  const [aw, as, ae, an] = aoi;
  const [sw, ss, se, sn] = scene;
  const iw = Math.max(aw, sw);
  const is = Math.max(as, ss);
  const ie = Math.min(ae, se);
  const inorth = Math.min(an, sn);
  if (ie <= iw || inorth <= is) return 0;
  const aoiArea = Math.max(1e-12, (ae - aw) * (an - as));
  return Math.max(0, Math.min(1, ((ie - iw) * (inorth - is)) / aoiArea));
}

export function boundsOverlap(
  a: { west: number; south: number; east: number; north: number },
  b: BBox,
  minRatio = 0.5,
): boolean {
  const ab: BBox = [a.west, a.south, a.east, a.north];
  return coverageRatio(ab, b) >= minRatio || coverageRatio(b, [a.west, a.south, a.east, a.north]) >= minRatio;
}
