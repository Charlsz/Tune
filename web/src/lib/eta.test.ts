import { describe, expect, it } from "vitest";
import { formatRemain, remainingSeconds, type EtaMemory } from "./eta";

const blank: EtaMemory = { fetchS: null, inferS: null };
const learned: EtaMemory = { fetchS: 20, inferS: 40 };

describe("remainingSeconds", () => {
  it("en inferencia usa lo aprendido y no suma otra escena de 5 min", () => {
    const budget = { current: 0 };
    const left = remainingSeconds(
      { phase: "infer" },
      10,
      false,
      1,
      learned,
      budget,
    );
    // 40 − 10 de esta escena + 20 de descarga y 40 de inferencia de la siguiente.
    expect(left).toBeCloseTo(90, 5);
  });

  it("si la inferencia se pasa, el presupuesto crece poco a poco", () => {
    const budget = { current: 40 };
    const left = remainingSeconds(
      { phase: "infer" },
      50,
      false,
      0,
      learned,
      budget,
    );
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(15);
    expect(budget.current).toBeGreaterThan(50);
    expect(budget.current).toBeLessThan(60);
  });

  it("la descarga resta por velocidad y deja la inferencia aprendida", () => {
    const budget = { current: 0 };
    const left = remainingSeconds(
      { phase: "fetch", loaded: 50, total: 100 },
      10,
      false,
      0,
      learned,
      budget,
    );
    // 10 s para el resto del archivo + 40 de inferencia. Sin pesos: no es la primera.
    expect(left).toBeCloseTo(50, 5);
  });

  it("la primera preparación suma los pesos una sola vez", () => {
    const first = remainingSeconds(
      { phase: "check" },
      1,
      true,
      1,
      blank,
      { current: 0 },
    );
    const later = remainingSeconds(
      { phase: "infer" },
      0,
      true,
      1,
      blank,
      { current: 0 },
    );
    expect(first).toBeGreaterThan(later);
    expect(first - later).toBe(120 + 30 + 8);
  });
});

describe("formatRemain", () => {
  it("baja segundo a segundo, también por encima del minuto", () => {
    expect(formatRemain(61)).toBe("1 min 1 s");
    expect(formatRemain(62)).toBe("1 min 2 s");
    expect(formatRemain(45)).toBe("45 s");
  });
});
