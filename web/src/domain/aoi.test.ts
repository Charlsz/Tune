import { describe, expect, it } from "vitest";
import { aoiAreaKm2, aoiHeadline, formatAoiKm2 } from "./aoi";

const sindh: [number, number, number, number] = [67.845, 27.01, 68.055, 27.19];

describe("aoiAreaKm2", () => {
  it("es el producto del alto y el ancho del rectángulo", () => {
    expect(aoiAreaKm2(sindh)).toBeGreaterThan(400);
    expect(aoiAreaKm2(sindh)).toBeLessThan(430);
  });

  it("formatea entero desde 100 km² y un decimal por debajo", () => {
    expect(formatAoiKm2(sindh)).toMatch(/^\d+ km²$/);
    const thin: [number, number, number, number] = [68, 27, 68.02, 27.02];
    expect(formatAoiKm2(thin)).toMatch(/^\d+,\d km²$/);
  });
});

describe("aoiHeadline", () => {
  it("usa el nombre del lugar", () => {
    expect(aoiHeadline("Sindh, Pakistán", sindh)).toBe("Sindh, Pakistán");
  });

  it("cae a coordenadas si no hay sitio", () => {
    expect(aoiHeadline("Área dibujada", sindh)).toBe("27.1000, 67.9500");
    expect(aoiHeadline("Coordenadas", sindh)).toBe("27.1000, 67.9500");
    expect(aoiHeadline("  ", sindh)).toBe("27.1000, 67.9500");
  });
});
