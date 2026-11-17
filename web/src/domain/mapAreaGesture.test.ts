import { describe, expect, it } from "vitest";
import {
  canSelectPointOnClick,
  pointSelectBbox,
  resolveDrawMouseUp,
} from "./mapAreaGesture";
import { bboxDimensionsKm } from "./aoi";

describe("canSelectPointOnClick", () => {
  it("bloquea click tras un gesto de dibujo (suppress)", () => {
    expect(
      canSelectPointOnClick({
        drawing: false,
        step: "area",
        suppressPointClick: true,
      }),
    ).toBe(false);
  });

  it("bloquea click mientras drawing está activo", () => {
    expect(
      canSelectPointOnClick({
        drawing: true,
        step: "area",
        suppressPointClick: false,
      }),
    ).toBe(false);
  });

  it("permite click→punto solo en paso area sin dibujar", () => {
    expect(
      canSelectPointOnClick({
        drawing: false,
        step: "area",
        suppressPointClick: false,
      }),
    ).toBe(true);
    expect(
      canSelectPointOnClick({
        drawing: false,
        step: "dates",
        suppressPointClick: false,
      }),
    ).toBe(false);
  });
});

describe("resolveDrawMouseUp", () => {
  it("commitea un rectángulo usable como Área dibujada", () => {
    const result = resolveDrawMouseUp(
      { lat: 27.0, lng: 68.0 },
      { lat: 27.2, lng: 68.3 },
    );
    expect(result.kind).toBe("commit");
    if (result.kind === "commit") {
      expect(result.label).toBe("Área dibujada");
      expect(result.bbox[0]).toBeLessThan(result.bbox[2]);
    }
  });

  it("rechaza click sin arrastre y conserva draft nulo o degenerado", () => {
    const result = resolveDrawMouseUp(
      { lat: 27.1, lng: 68.0 },
      { lat: 27.1, lng: 68.0 },
    );
    expect(result.kind).toBe("reject");
    if (result.kind === "reject") {
      expect(result.error.toLowerCase()).toMatch(/inválida|pequeña/);
    }
  });

  it("rechaza área demasiado pequeña pero deja draft normalizado", () => {
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

describe("pointSelectBbox", () => {
  it("crea un cuadrado ~35 km centrado en el click", () => {
    const bbox = pointSelectBbox(27.1, 68.0);
    const { heightKm, widthKm } = bboxDimensionsKm(bbox);
    expect(Math.max(heightKm, widthKm)).toBeGreaterThan(30);
    expect(Math.max(heightKm, widthKm)).toBeLessThan(40);
  });
});
