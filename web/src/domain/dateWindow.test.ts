import { describe, expect, it } from "vitest";
import {
  addDays,
  dateInWeek,
  formatWeekRange,
  weekEnd,
  weekWindow,
  weekWindowsValid,
} from "./dateWindow";

describe("weekWindow", () => {
  it("cubre 7 días inclusivos desde el inicio", () => {
    expect(weekWindow("2022-05-18")).toEqual({
      start: "2022-05-18",
      end: "2022-05-24",
    });
    expect(weekEnd("2022-05-18")).toBe("2022-05-24");
  });

  it("cruza de mes con addDays", () => {
    expect(addDays("2022-05-28", 6)).toBe("2022-06-03");
  });
});

describe("weekWindowsValid", () => {
  it("exige que Después empiece después del fin de Antes", () => {
    expect(weekWindowsValid("2022-05-18", "2022-09-05")).toBe(true);
    expect(weekWindowsValid("2022-05-18", "2022-05-24")).toBe(false);
    expect(weekWindowsValid("2022-05-18", "2022-05-25")).toBe(true);
    expect(weekWindowsValid("2022-05-18", "2022-05-10")).toBe(false);
    expect(weekWindowsValid("", "2022-09-05")).toBe(false);
  });
});

describe("formatWeekRange / dateInWeek", () => {
  it("une inicio y fin con el formateador dado", () => {
    expect(formatWeekRange("2022-05-18", (d) => d)).toBe(
      "2022-05-18 – 2022-05-24",
    );
  });

  it("detecta días dentro de la semana", () => {
    expect(dateInWeek("2022-05-20", "2022-05-18")).toBe(true);
    expect(dateInWeek("2022-05-24", "2022-05-18")).toBe(true);
    expect(dateInWeek("2022-05-25", "2022-05-18")).toBe(false);
  });
});
