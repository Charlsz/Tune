import type { Place } from "../types";

/** Bbox WGS84 [west, south, east, north] centrado en el punto — misma fórmula que el backend. */
export function bboxFromPoint(
  lat: number,
  lon: number,
  sideKm: number,
): [number, number, number, number] {
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
  bbox: [number, number, number, number],
): [[number, number], [number, number]] {
  const [west, south, east, north] = bbox;
  return [
    [south, west],
    [north, east],
  ];
}
