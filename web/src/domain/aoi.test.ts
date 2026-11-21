import { describe, expect, it } from "vitest";
import {
  aoiAreaKm2,
  aoiFillPercent,
  aoiHeadline,
  formatAoiKm2,
  imageClip,
} from "./aoi";

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

describe("aoiFillPercent", () => {
  const aoi: [number, number, number, number] = [68, 27, 68.2, 27.2];

  it("es 100 cuando la escena envuelve el recorte", () => {
    expect(aoiFillPercent(aoi, [67, 26, 69, 28])).toBe(100);
  });

  it("es la fracción del recorte que sí cae en la escena", () => {
    expect(aoiFillPercent(aoi, [68.1, 27, 69, 27.2])).toBe(50);
  });

  it("es 0 si no se tocan", () => {
    expect(aoiFillPercent(aoi, [0, 0, 1, 1])).toBe(0);
    expect(aoiFillPercent(aoi, [])).toBe(0);
  });
});

describe("imageClip", () => {
  const box: [number, number, number, number] = [0, 0, 2, 2];

  it("no recorta cuando la imagen es el AOI", () => {
    expect(imageClip(box, box, "mask", 50, "full")).toBe("inset(0% 0% 0% 0%)");
  });

  it("parte el deslizador por la mitad sin depender del zoom", () => {
    expect(imageClip(box, box, "swipe", 50, "before")).toBe(
      "inset(0% 50% 0% 0%)",
    );
    expect(imageClip(box, box, "swipe", 50, "after")).toBe(
      "inset(0% 0% 0% 50%)",
    );
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
