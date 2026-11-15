import { describe, expect, it } from "vitest";
import { bboxFromPoint as libBboxFromPoint } from "../lib/aoi";
import { bboxFromPoint, bboxCenter, aoiSideKm } from "../domain/aoi";
import type { Analysis, CatalogScene } from "../types";
import {
  aoiFitsCatalogLimits,
  analysesToResult,
  catalogQueryFromAoi,
  catalogSceneToUi,
} from "./apiBridge";
import { selectionKey } from "../domain/lab";

describe("compatibilidad AOI UI ↔ backend", () => {
  it("domain y lib usan la misma fórmula de bbox que el backend Python", () => {
    const a = bboxFromPoint(4.6, -74.1, 20);
    const b = libBboxFromPoint(4.6, -74.1, 20);
    expect(a).toEqual(b);
    const [west, south, east, north] = a;
    expect((north - south) * 110.57).toBeCloseTo(20, 1);
    expect(west).toBeLessThan(-74.1);
    expect(east).toBeGreaterThan(-74.1);
  });

  it("catalogQueryFromAoi produce lat/lon/sideKm válidos para /api/catalog/search", () => {
    const aoi: [number, number, number, number] = [67.65, 26.8, 68.25, 27.4];
    const q = catalogQueryFromAoi(aoi, "2022-05-18");
    const center = bboxCenter(aoi);
    expect(q.lat).toBeCloseTo(center.lat, 6);
    expect(q.lon).toBeCloseTo(center.lon, 6);
    expect(q.start).toBe("2022-05-18");
    expect(q.end).toBe("2022-05-18");
    expect(q.sideKm).toBeGreaterThanOrEqual(1);
    expect(q.sideKm).toBeLessThanOrEqual(50);
    expect(q.lat).toBeGreaterThanOrEqual(-90);
    expect(q.lat).toBeLessThanOrEqual(90);
    expect(q.lon).toBeGreaterThanOrEqual(-180);
    expect(q.lon).toBeLessThanOrEqual(180);
  });

  it("respeta max_side_km del catálogo", () => {
    const small: [number, number, number, number] = [68.0, 27.0, 68.1, 27.1];
    const huge: [number, number, number, number] = [60, 20, 70, 30];
    expect(aoiFitsCatalogLimits(small, 50)).toBe(true);
    expect(aoiFitsCatalogLimits(huge, 50)).toBe(false);
    expect(aoiSideKm({ mode: "rectangle", bbox: small })).toBeLessThan(50);
  });
});

describe("mapeo CatalogScene / Analysis → UI", () => {
  const catalog: CatalogScene = {
    id: "S2A_20220518",
    datetime: "2022-05-18T10:30:00Z",
    cloud_cover: 4,
    bbox: [67.4, 26.5, 68.6, 27.7],
    thumbnail: "https://example.com/thumb.jpg",
  };

  it("catalogSceneToUi conserva id/bbox y usa thumbnail como image", () => {
    const scene = catalogSceneToUi(catalog);
    expect(scene.id).toBe(catalog.id);
    expect(scene.bbox).toEqual(catalog.bbox);
    expect(scene.image).toBe(catalog.thumbnail);
    expect(scene.datetime).toBe(catalog.datetime);
  });

  it("analysesToResult usa change.new_area_km2 y mantiene selectionKey", () => {
    const aoi: [number, number, number, number] = [67.65, 26.8, 68.25, 27.4];
    const before = catalogSceneToUi(catalog);
    const after = catalogSceneToUi({
      ...catalog,
      id: "S2A_20220905",
      datetime: "2022-09-05T10:30:00Z",
    });
    const beforeAnalysis = {
      id: "a1",
      created_at: "2022-05-18T12:00:00Z",
      change: null,
      affected_area_km2: 1,
      artifacts: { preview_png: "/api/a1/preview.png", mask_png: "/api/a1/mask.png" },
    } as unknown as Analysis;
    const afterAnalysis = {
      id: "a2",
      created_at: "2022-09-05T12:00:00Z",
      change: { new_area_km2: 12.5 },
      affected_area_km2: 20,
      artifacts: {
        preview_png: "/api/a2/preview.png",
        mask_png: "/api/a2/mask.png",
        change_png: "/api/a2/change.png",
      },
    } as unknown as Analysis;

    const result = analysesToResult(
      aoi,
      before,
      after,
      beforeAnalysis,
      afterAnalysis,
    );
    expect(result.key).toBe(selectionKey(aoi, before, after));
    expect(result.areaKm2).toBe(12.5);
    expect(result.id).toBe("a2");
    expect(result.cells).toEqual([]);
    expect(result.overlays?.change).toBe("/api/a2/change.png");
  });
});
