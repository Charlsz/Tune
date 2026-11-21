import { describe, expect, it } from "vitest";
import { preferEarlierFirst, sameTerritory } from "./territory";

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
