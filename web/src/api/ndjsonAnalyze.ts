import type { Analysis } from "../types";

/** Parsea un stream NDJSON de analyze (ejemplos o catálogo). */
export async function readAnalyzeNdjson(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: {
    phase: string;
    loaded?: number;
    total?: number;
    refreshed?: boolean;
    stale?: boolean;
    analysis?: Analysis;
    detail?: string;
  }) => void,
): Promise<Analysis> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let analysis: Analysis | null = null;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const event = JSON.parse(trimmed) as {
      phase: string;
      loaded?: number;
      total?: number;
      refreshed?: boolean;
      stale?: boolean;
      analysis?: Analysis;
      detail?: string;
    };
    onEvent(event);
    if (event.phase === "done" && event.analysis) {
      analysis = event.analysis;
    } else if (event.phase === "error") {
      throw new Error(event.detail ?? "Error al analizar");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
  }
  if (buffer.trim()) handleLine(buffer);

  if (!analysis) throw new Error("La corrida terminó sin resultado");
  return analysis;
}
