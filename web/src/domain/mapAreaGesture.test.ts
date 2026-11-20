import { describe, expect, it } from "vitest";
import { resolveDrawMouseUp } from "./mapAreaGesture";
import { bboxDimensionsKm } from "./aoi";

describe("resolveDrawMouseUp", () => {
  it("commitea el rectángulo exacto dibujado (sin expandir a 35 km)", () => {
    const result = resolveDrawMouseUp(
      { lat: 27.0, lng: 68.0 },
      { lat: 27.05, lng: 68.08 },
    );
    expect(result.kind).toBe("commit");
    if (result.kind !== "commit") return;
    expect(result.label).toBe("Área dibujada");
    expect(result.bbox).toEqual([68.0, 27.0, 68.08, 27.05]);
    const { heightKm, widthKm } = bboxDimensionsKm(result.bbox);
    expect(Math.max(heightKm, widthKm)).toBeLessThan(20);
  });

  it("commitea un sub-rectángulo pequeño pero usable dentro de un AOI previo", () => {
    const result = resolveDrawMouseUp(
      { lat: 27.1, lng: 68.0 },
      { lat: 27.12, lng: 68.03 },
    );
    expect(result.kind).toBe("commit");
    if (result.kind !== "commit") return;
    expect(result.bbox[0]).toBe(68.0);
    expect(result.bbox[2]).toBe(68.03);
  });

  it("rechaza click sin arrastre", () => {
    const result = resolveDrawMouseUp(
      { lat: 27.1, lng: 68.0 },
      { lat: 27.1, lng: 68.0 },
    );
    expect(result.kind).toBe("reject");
  });

  it("rechaza área demasiado pequeña y conserva draft", () => {
    const result = resolveDrawMouseUp(
      { lat: 27.1, lng: 68.0 },
      { lat: 27.1005, lng: 68.0005 },
    );
    expect(result.kind).toBe("reject");
    if (result.kind === "reject") {
      expect(result.draft).not.toBeNull();
      expect(result.error).toMatch(/pequeña|inválida/i);
    }
  });
});
