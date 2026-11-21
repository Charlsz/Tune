import { describe, expect, it } from "vitest";
import {
  boxToBBox,
  boxesClose,
  canPlaceOnMap,
  preferEarlierFirst,
  sameTerritory,
  unionBox,
} from "./territory";

describe("sameTerritory", () => {
  const magdalena = { west: -74.7, south: 8.8, east: -74.6, north: 8.9 };

  it("acepta el mismo recorte", () => {
    expect(sameTerritory(magdalena, magdalena)).toBe(true);
  });

  it("rechaza un recorte lejano", () => {
    const sindh = { west: 68.8, south: 27.6, east: 68.9, north: 27.8 };
    expect(sameTerritory(magdalena, sindh)).toBe(false);
  });
});

describe("canPlaceOnMap", () => {
  it("acepta una caja con área", () => {
    const box = { west: 68.8, south: 27.6, east: 68.9, north: 27.8 };
    expect(canPlaceOnMap(box)).toBe(true);
    expect(boxToBBox(box)).toEqual([68.8, 27.6, 68.9, 27.8]);
  });

  it("rechaza null, degenerada o no finita", () => {
    expect(canPlaceOnMap(null)).toBe(false);
    expect(canPlaceOnMap(undefined)).toBe(false);
    expect(
      canPlaceOnMap({ west: 1, south: 1, east: 1, north: 2 }),
    ).toBe(false);
    expect(
      canPlaceOnMap({ west: 0, south: 0, east: Number.NaN, north: 1 }),
    ).toBe(false);
  });

  it("une dos cajas y las compara con tolerancia", () => {
    const a = { west: 68.8, south: 27.6, east: 68.9, north: 27.7 };
    const b = { west: 68.85, south: 27.65, east: 69.0, north: 27.8 };
    const union = unionBox(a, b);
    expect(union).toEqual({ west: 68.8, south: 27.6, east: 69.0, north: 27.8 });
    expect(boxesClose(boxToBBox(union), [68.8, 27.6, 69.0, 27.8000004])).toBe(
      true,
    );
    expect(boxesClose(boxToBBox(a), boxToBBox(b))).toBe(false);
  });
});

describe("preferEarlierFirst", () => {
  it("deja el archivo más antiguo en Antes", () => {
    const later = { acquiredAt: "2022-09-05", name: "pico" };
    const earlier = { acquiredAt: "2022-05-18", name: "base" };
    const ordered = preferEarlierFirst(later, earlier);
    expect(ordered.reordered).toBe(true);
    expect(ordered.before.name).toBe("base");
    expect(ordered.after.name).toBe("pico");
  });

  it("respeta el orden si falta una fecha", () => {
    const a: { acquiredAt: string | null; name: string } = {
      acquiredAt: null,
      name: "a",
    };
    const b: { acquiredAt: string | null; name: string } = {
      acquiredAt: "2022-05-18",
      name: "b",
    };
    const ordered = preferEarlierFirst(a, b);
    expect(ordered.reordered).toBe(false);
    expect(ordered.before.name).toBe("a");
  });
});
