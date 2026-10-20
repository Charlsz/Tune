import { describe, expect, it } from "vitest";
import { geotiffHints, validateGeotiffFile } from "./geotiffFile";

function fakeFile(name: string, size: number): File {
  const buf = new Uint8Array(Math.min(size, 8));
  const file = new File([buf], name, { type: "image/tiff" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateGeotiffFile", () => {
  it("accepts .tif within size limit", () => {
    expect(validateGeotiffFile(fakeFile("scene.tif", 1024))).toEqual({ ok: true });
  });

  it("rejects non-tif", () => {
    const r = validateGeotiffFile(fakeFile("a.png", 10));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/tif/i);
  });

  it("rejects oversized files", () => {
    const r = validateGeotiffFile(fakeFile("huge.tif", 201 * 1024 * 1024));
    expect(r.ok).toBe(false);
  });
});

describe("geotiffHints", () => {
  it("mentions Prithvi bands", () => {
    const hints = geotiffHints(fakeFile("x.tif", 1000));
    expect(hints.some((h) => /6 bandas|Prithvi/i.test(h))).toBe(true);
  });
});
