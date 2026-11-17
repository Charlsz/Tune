import { describe, expect, it } from "vitest";
import { readAnalyzeNdjson } from "./ndjsonAnalyze";
import type { Analysis } from "../types";

function streamOf(lines: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const text = lines.map((l) => l + "\n").join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(text));
      controller.close();
    },
  });
}

const sampleAnalysis = {
  id: "abc123def456",
  task: "flood",
} as Analysis;

describe("readAnalyzeNdjson", () => {
  it("returns analysis from done event and reports download/infer", async () => {
    const phases: string[] = [];
    const analysis = await readAnalyzeNdjson(
      streamOf([
        JSON.stringify({ phase: "download", loaded: 2, total: 7 }),
        JSON.stringify({ phase: "infer" }),
        JSON.stringify({ phase: "done", analysis: sampleAnalysis }),
      ]),
      (e) => phases.push(e.phase),
    );
    expect(analysis.id).toBe("abc123def456");
    expect(phases).toEqual(["download", "infer", "done"]);
  });

  it("throws on error phase", async () => {
    await expect(
      readAnalyzeNdjson(
        streamOf([JSON.stringify({ phase: "error", detail: "nubes altas" })]),
        () => {},
      ),
    ).rejects.toThrow(/nubes altas/);
  });

  it("throws if stream ends without done", async () => {
    await expect(
      readAnalyzeNdjson(streamOf([JSON.stringify({ phase: "infer" })]), () => {}),
    ).rejects.toThrow(/sin resultado/i);
  });

  it("accepts a final line without trailing newline", async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          enc.encode(`${JSON.stringify({ phase: "done", analysis: sampleAnalysis })}`),
        );
        controller.close();
      },
    });
    const analysis = await readAnalyzeNdjson(body, () => {});
    expect(analysis.id).toBe("abc123def456");
  });
});
