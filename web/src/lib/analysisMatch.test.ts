import { describe, expect, it } from "vitest";
import { findCompatibleAnalysis } from "./analysisMatch";
import { aoiFromPoint, bboxFromPoint } from "./aoi";
import type { Analysis } from "../types";

function analysis(partial: Partial<Analysis>): Analysis {
  return {
    id: "abc",
    task: "flood",
    created_at: "2022-01-01T00:00:00Z",
    model_id: "x",
    input_filename: "S2_20220518T120000_abcdef12_deadbeef.tif",
    width: 10,
    height: 10,
    valid_pixels: 1,
    affected_pixels: 0,
    affected_ratio: 0,
    affected_area_km2: null,
    crs: "EPSG:4326",
    bounds: { west: -74.2, south: 4.6, east: -73.9, north: 4.9 },
    latency_s: 1,
    artifacts: {},
    acquired_at: "2022-05-18T12:00:00",
    metadata: {},
    change: null,
    fusion: null,
    exposure: null,
    ...partial,
  };
}

describe("findCompatibleAnalysis", () => {
  const aoi = aoiFromPoint({ lat: 4.75, lon: -74.05 }, 12, 30);
  const [west, south, east, north] = bboxFromPoint(4.75, -74.05, 12);

  it("no reutiliza solo por fecha si el AOI no solapa", () => {
    const far = analysis({
      bounds: { west: -80, south: 0, east: -79, north: 1 },
    });
    expect(findCompatibleAnalysis([far], { date: "2022-05-18", aoi })).toBeNull();
  });

  it("reutiliza si fecha, solape y escala coinciden", () => {
    const hit = analysis({ bounds: { west, south, east, north } });
    expect(
      findCompatibleAnalysis([hit], {
        date: "2022-05-18",
        aoi,
        sceneId: "xxxx_abcdef12",
      })?.id,
    ).toBe("abc");
  });
});
