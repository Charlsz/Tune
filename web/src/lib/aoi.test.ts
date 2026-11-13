import { describe, expect, it } from "vitest";
import {
  aoiFromPoint,
  aoiFromRectangle,
  bboxDimensionsKm,
  bboxFromPoint,
  bboxToLatLngBounds,
  clampSideKm,
  coverageRatio,
  formatPlaceCoords,
  parseCoords,
  validateAoiBbox,
} from "./aoi";

describe("aoi helpers", () => {
  it("parseCoords acepta lat,lon válidas", () => {
    expect(parseCoords("4.71, -74.07")).toEqual({ lat: 4.71, lon: -74.07 });
    expect(parseCoords("27.7,68.85")).toEqual({ lat: 27.7, lon: 68.85 });
  });

  it("parseCoords rechaza fuera de rango o basura", () => {
    expect(parseCoords("91, 0")).toBeNull();
    expect(parseCoords("0, 200")).toBeNull();
    expect(parseCoords("Bogotá")).toBeNull();
    expect(parseCoords("")).toBeNull();
  });

  it("bboxFromPoint centra el recorte (misma idea que el backend)", () => {
    const [west, south, east, north] = bboxFromPoint(4.6, -74.1, 20);
    expect(west).toBeLessThan(-74.1);
    expect(east).toBeGreaterThan(-74.1);
    expect(south).toBeLessThan(4.6);
    expect(north).toBeGreaterThan(4.6);
    const heightKm = (north - south) * 110.57;
    expect(heightKm).toBeCloseTo(20, 1);
  });

  it("bboxToLatLngBounds usa orden Leaflet", () => {
    expect(bboxToLatLngBounds([-75, 4, -74, 5])).toEqual([
      [4, -75],
      [5, -74],
    ]);
  });

  it("clampSideKm respeta límites seguros", () => {
    expect(clampSideKm(0, 30)).toBe(1);
    expect(clampSideKm(50, 30)).toBe(30);
    expect(clampSideKm(12, 30)).toBe(12);
    expect(clampSideKm(Number.NaN, 30)).toBe(1);
  });

  it("formatPlaceCoords redondea", () => {
    expect(formatPlaceCoords({ lat: 4.71111, lon: -74.07222 })).toBe("4.7111, -74.0722");
  });

  it("validateAoiBbox rechaza AOI demasiado grande", () => {
    const huge = bboxFromPoint(0, 0, 80);
    expect(validateAoiBbox(huge, 30).ok).toBe(false);
  });

  it("aoiFromRectangle conserva el bbox pedido", () => {
    const bbox: [number, number, number, number] = [-74.2, 4.6, -74.0, 4.8];
    const aoi = aoiFromRectangle(bbox, 30);
    expect("error" in aoi).toBe(false);
    if (!("error" in aoi)) {
      expect(aoi.mode).toBe("rectangle");
      expect(aoi.bbox).toEqual(bbox);
      const { heightKm, widthKm } = bboxDimensionsKm(aoi.bbox);
      expect(heightKm).toBeGreaterThan(0);
      expect(widthKm).toBeGreaterThan(0);
    }
  });

  it("aoiFromPoint y coverageRatio son coherentes", () => {
    const aoi = aoiFromPoint({ lat: 4.7, lon: -74.1 }, 12, 30);
    expect(aoi.mode).toBe("point");
    expect(coverageRatio(aoi.bbox, aoi.bbox)).toBeCloseTo(1, 5);
    expect(coverageRatio(aoi.bbox, [-80, 0, -79, 1])).toBe(0);
  });
});
