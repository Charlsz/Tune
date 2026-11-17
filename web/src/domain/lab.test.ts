import { describe, it, expect } from "vitest";
import { initialState, reducer, type State } from "./lab";
import { demoProvider, cellBounds, clippedCell, extent } from "../data/demo";
import { aoiFromPoint, validateAoiBbox } from "./aoi";
describe("AOI y proveedor geográfico", () => {
  it("selecciona puntos, normaliza rectángulos y rechaza áreas inválidas", () => {
    expect(aoiFromPoint({ lat: 27, lon: 68 }, 35, 150).bbox[0]).toBeLessThan(
      68,
    );
    expect(validateAoiBbox([68, 27, 67.9, 26.9], 150).ok).toBe(true);
    expect(validateAoiBbox([0, 0, 0, 0], 150).ok).toBe(false);
  });
  it("devuelve estados vacíos fuera de cobertura y fechas", async () => {
    expect(await demoProvider.scenes([0, 0, 1, 1], "2022-05-18")).toEqual([]);
    expect(await demoProvider.scenes(initialState.aoi, "2023-05-18")).toEqual(
      [],
    );
  });
  it("mantiene la misma georreferencia para ambas escenas", async () => {
    const [before] = await demoProvider.scenes(
      initialState.aoi,
      initialState.dates[0],
    );
    const [after] = await demoProvider.scenes(
      initialState.aoi,
      initialState.dates[1],
    );
    expect(before.bbox).toEqual(after.bbox);
    expect(before.water.length).toBe(after.water.length);
    expect(before.bbox).toEqual(extent);
  });
  it("recorta las celdas al AOI y calcula exclusivamente agua nueva", async () => {
    const [before] = await demoProvider.scenes(
      initialState.aoi,
      initialState.dates[0],
    );
    const [after] = await demoProvider.scenes(
      initialState.aoi,
      initialState.dates[1],
    );
    const result = await demoProvider.analyze(initialState.aoi, before, after);
    expect(result.areaKm2).toBeGreaterThan(0);
    expect(result.areaKm2).toBeCloseTo(
      result.cells.reduce((n, c) => n + c.areaKm2, 0),
    );
    const unchanged = await demoProvider.analyze(
      initialState.aoi,
      before,
      before,
    );
    expect(unchanged.cells).toEqual([]);
    expect(clippedCell(0, initialState.aoi)).toBeNull();
    expect(cellBounds(0)[0]).toBe(extent[0]);
  });
});
describe("estado temporal", () => {
  it.each(["before", "after", "change"] as const)(
    "cambia a %s sin mover AOI",
    (mode) => {
      const s = reducer(initialState, { type: "view", patch: { mode } });
      expect(s.mode).toBe(mode);
      expect(s.aoi).toBe(initialState.aoi);
    },
  );
  it("activa máscara, opacidad y slider con límites", () => {
    const s = reducer(initialState, {
      type: "view",
      patch: { mask: false, opacity: 2, slider: true, split: -4 },
    });
    expect(s).toMatchObject({
      mask: false,
      opacity: 1,
      slider: true,
      split: 0,
    });
  });
  it("navega y cambia variante conservando la selección", () => {
    const s = reducer(initialState, {
      type: "view",
      patch: { variant: "sidebar", page: "history" },
    });
    expect(s.aoi).toBe(initialState.aoi);
    expect(s.dates).toBe(initialState.dates);
    expect(s.page).toBe("history");
  });
  it("invalida resultado y escenas al modificar fecha o AOI", async () => {
    const [before] = await demoProvider.scenes(
      initialState.aoi,
      initialState.dates[0],
    );
    const [after] = await demoProvider.scenes(
      initialState.aoi,
      initialState.dates[1],
    );
    let s: State = { ...initialState, selected: [before, after] };
    const result = await demoProvider.analyze(s.aoi, before, after);
    s = reducer(s, { type: "result", result });
    expect(s.result).toMatchObject({ ...result, label: initialState.label });
    expect(s.history[0]?.label).toBe(initialState.label);
    expect(s.mode).toBe("change");
    const changed = reducer(s, { type: "date", index: 0, value: "2022-06-01" });
    expect(changed.result).toBeNull();
    expect(changed.selected).toEqual([null, null]);
    expect(reducer(changed, { type: "result", result }).result).toBeNull();
    expect(
      reducer(s, { type: "area", bbox: [0, 0, 1, 1], label: "Otra" }).result,
    ).toBeNull();
    const reselected = reducer(s, { type: "scene", index: 1, scene: before });
    expect(reselected.result).toBeNull();
    expect(reducer(reselected, { type: "result", result }).result).toBeNull();
  });

  it("restaura un análisis del historial como activo sin duplicarlo", async () => {
    const [before] = await demoProvider.scenes(
      initialState.aoi,
      initialState.dates[0],
    );
    const [after] = await demoProvider.scenes(
      initialState.aoi,
      initialState.dates[1],
    );
    let s: State = { ...initialState, selected: [before, after] };
    const first = await demoProvider.analyze(s.aoi, before, after);
    s = reducer(s, { type: "result", result: first });
    const second = {
      ...first,
      id: "second-id",
      label: "Otro lugar",
      areaKm2: 1.5,
    };
    s = {
      ...s,
      history: [second, ...s.history],
      result: second,
      label: "Otro lugar",
    };
    expect(s.history).toHaveLength(2);

    const restored = reducer(s, { type: "restore", id: s.history[1]!.id });
    expect(restored.result?.id).toBe(s.history[1]!.id);
    expect(restored.history).toHaveLength(2);
    expect(restored.label).toBe(initialState.label);
    expect(restored.selected[0]?.id).toBe(before.id);
    expect(restored.mode).toBe("change");
    expect(restored.step).toBe("results");
    expect(reducer(s, { type: "restore", id: "missing" })).toBe(s);
  });
});
