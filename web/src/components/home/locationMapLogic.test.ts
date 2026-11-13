import { describe, expect, it } from "vitest";
import { bboxFromPoint, clampSideKm, formatPlaceCoords } from "../../lib/aoi";
import type { Place } from "../../types";

/** Lógica de confirmación del mapa (sin montar Leaflet en jsdom). */
function draftPending(place: Place | null, draft: Place | null): boolean {
  return (
    draft != null && (place == null || draft.lat !== place.lat || draft.lon !== place.lon)
  );
}

describe("integración mapa → formulario / STAC", () => {
  it("un clic crea borrador pendiente de confirmar", () => {
    const draft = { lat: 8.85, lon: -74.65 };
    expect(draftPending(null, draft)).toBe(true);
    expect(draftPending(draft, draft)).toBe(false);
  });

  it("el AOI del mapa usa el mismo bbox que alimenta side_km al catálogo", () => {
    const place = { lat: 27.7, lon: 68.85 };
    const sideKm = clampSideKm(12, 30);
    const [west, south, east, north] = bboxFromPoint(place.lat, place.lon, sideKm);
    expect(west).toBeLessThan(place.lon);
    expect(east).toBeGreaterThan(place.lon);
    expect(south).toBeLessThan(place.lat);
    expect(north).toBeGreaterThan(place.lat);
    expect(formatPlaceCoords(place)).toContain("27.7000");
  });

  it("recortes fuera de límite se acotan antes de buscar escenas", () => {
    expect(clampSideKm(40, 30)).toBe(30);
    expect(clampSideKm(0.5, 30)).toBe(1);
  });
});
