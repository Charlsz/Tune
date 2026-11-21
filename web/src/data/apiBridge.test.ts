import { describe, expect, it } from "vitest";
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
  it("bboxFromPoint usa la misma fórmula de bbox que el backend Python", () => {
    const a = bboxFromPoint(4.6, -74.1, 20);
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
    expect(q.maxCloud).toBe(40);
    expect(q.lat).toBeGreaterThanOrEqual(-90);
    expect(q.lat).toBeLessThanOrEqual(90);
    expect(q.lon).toBeGreaterThanOrEqual(-180);
    expect(q.lon).toBeLessThanOrEqual(180);
  });

  it("catalogQueryFromAoi reenvía un maxCloud distinto de 40", () => {
    const aoi: [number, number, number, number] = [67.65, 26.8, 68.25, 27.4];
    const q = catalogQueryFromAoi(aoi, "2022-09-05", 49, 50);
    expect(q.maxCloud).toBe(49);
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
      model_id: "ibm-nasa-geospatial/Prithvi-EO-2.0-300M-TL-Sen1Floods11",
      change: { new_area_km2: 12.5, persistent_area_km2: 3.1 },
      affected_area_km2: 20,
      exposure: {
        population_exposed: 1250,
        classes: [{ label: "Cropland", area_km2: 4.2, fraction: 0.4 }],
      },
      fusion: { iou: 0.61, sources: ["gfm"] },
      metadata: { pipeline: { observation: "ok", reference: "ok", exposure: "ok" } },
      artifacts: {
        preview_png: "/api/a2/preview.png",
        mask_png: "/api/a2/mask.png",
        change_png: "/api/a2/change.png",
        fusion_png: "/api/a2/fusion.png",
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
    expect(result.overlays?.fusion).toBe("/api/a2/fusion.png");
    expect(result.metrics?.population).toBe(1250);
    expect(result.metrics?.newKm2).toBe(12.5);
    expect(result.metrics?.cover[0]?.label).toBe("Cropland");
    expect(result.metrics?.fusionIou).toBe(0.61);
    expect(result.metrics?.fusionSources).toEqual(["gfm"]);
    expect(result.metrics?.observation).toBe("ok");
  });

  it("analysesToResult deja fusión vacía si no hubo GFM", () => {
    const aoi: [number, number, number, number] = [67.65, 26.8, 68.25, 27.4];
    const scene = catalogSceneToUi(catalog);
    const base = {
      id: "a0",
      created_at: "2022-05-18T12:00:00Z",
      model_id: "ibm-nasa-geospatial/Prithvi-EO-2.0-300M-TL-Sen1Floods11",
      change: null,
      affected_area_km2: 1,
      fusion: null,
      metadata: {
        pipeline: { observation: "empty", reference: "ok", exposure: "ok" },
      },
      artifacts: { preview_png: "/p.png", mask_png: "/m.png" },
    } as unknown as Analysis;
    const result = analysesToResult(aoi, scene, scene, base, base);
    expect(result.overlays?.fusion).toBeUndefined();
    expect(result.metrics?.fusionIou).toBeNull();
    expect(result.metrics?.observation).toBe("empty");
  });
});
