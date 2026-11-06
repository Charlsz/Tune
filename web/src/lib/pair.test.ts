import { describe, expect, it } from "vitest";
import type { Analysis } from "../types";
import { analysisDate, findBeforeMate, findByDate } from "./pair";

function stub(partial: Partial<Analysis> & Pick<Analysis, "id">): Analysis {
  return {
    task: "flood",
    created_at: "2022-01-01T00:00:00Z",
    model_id: "m",
    input_filename: "x.tif",
    width: 1,
    height: 1,
    valid_pixels: 1,
    affected_pixels: 0,
    affected_ratio: 0,
    affected_area_km2: null,
    crs: null,
    bounds: null,
    latency_s: 1,
    artifacts: {},
    acquired_at: null,
    metadata: {},
    change: null,
    fusion: null,
    exposure: null,
    ...partial,
  };
}

describe("pair helpers", () => {
  it("analysisDate lee YYYY-MM-DD", () => {
    expect(analysisDate(stub({ id: "a", acquired_at: "2022-09-05T12:00:00Z" }))).toBe(
      "2022-09-05",
    );
    expect(analysisDate(stub({ id: "b" }))).toBeNull();
  });

  it("findBeforeMate usa reference_dates", () => {
    const before = stub({ id: "pre", acquired_at: "2022-05-18" });
    const after = stub({
      id: "peak",
      acquired_at: "2022-09-05",
      change: {
        reference_source: "history_baseline",
        reference_id: "pre",
        reference_dates: ["2022-05-18"],
        new_pixels: 1,
        persistent_pixels: 1,
        receded_pixels: 0,
        compared_pixels: 2,
        new_area_km2: 10,
        persistent_area_km2: 2,
        receded_area_km2: 0,
      },
    });
    expect(findBeforeMate(after, [before, after])?.id).toBe("pre");
  });

  it("findBeforeMate cae a la fecha anterior más cercana", () => {
    const a = stub({ id: "a", acquired_at: "2022-02-01" });
    const b = stub({ id: "b", acquired_at: "2022-05-18" });
    const c = stub({ id: "c", acquired_at: "2022-09-05" });
    expect(findBeforeMate(c, [a, b, c])?.id).toBe("b");
  });

  it("findByDate", () => {
    const list = [stub({ id: "x", acquired_at: "2022-05-18" })];
    expect(findByDate(list, "2022-05-18")?.id).toBe("x");
    expect(findByDate(list, "2022-01-01")).toBeNull();
  });
});
