import type { Analysis, CatalogScene, ExampleScene, Place, TaskId, TaskInfo } from "./types";

function detailOf(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail ?? fallback;
  return typeof detail === "string" ? detail : JSON.stringify(detail);
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(detailOf(body, res.statusText));
  }
  return res.json() as Promise<T>;
}

export type AnalyzePhase =
  | { phase: "upload"; loaded: number; total: number }
  | { phase: "check"; stale?: boolean }
  | { phase: "fetch"; loaded: number; total: number; refreshed?: boolean }
  | { phase: "infer" };

export const api = {
  tasks: () => fetch("/api/tasks").then(json<TaskInfo[]>),
  analyses(q: { limit?: number; lat?: number; lon?: number; task?: TaskId } = {}) {
    const p = new URLSearchParams({ limit: String(q.limit ?? 30) });
    if (q.lat != null) p.set("lat", String(q.lat));
    if (q.lon != null) p.set("lon", String(q.lon));
    if (q.task) p.set("task", q.task);
    return fetch(`/api/analyses?${p}`).then(json<Analysis[]>);
  },
  timeline(q: { analysisId?: string; lat?: number; lon?: number; task?: TaskId }) {
    const p = new URLSearchParams();
    if (q.analysisId) p.set("analysis_id", q.analysisId);
    if (q.lat != null) p.set("lat", String(q.lat));
    if (q.lon != null) p.set("lon", String(q.lon));
    if (q.task) p.set("task", q.task);
    return fetch(`/api/timeline?${p}`).then(json<Analysis[]>);
  },
  async remove(id: string) {
    const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" });
    if (res.status === 204) return;
    await json(res);
  },
  catalogSearch(q: {
    lat: number;
    lon: number;
    start: string;
    end: string;
    maxCloud?: number;
    sideKm?: number;
  }) {
    const p = new URLSearchParams({
      lat: String(q.lat),
      lon: String(q.lon),
      start: q.start,
      end: q.end,
      max_cloud: String(q.maxCloud ?? 40),
      side_km: String(q.sideKm ?? 20),
    });
    return fetch(`/api/catalog/search?${p}`).then(json<CatalogScene[]>);
  },
  catalogAnalyze(itemId: string, task: TaskId, place: Place, sideKm: number) {
    const body = new FormData();
    body.append("task", task);
    body.append("lat", String(place.lat));
    body.append("lon", String(place.lon));
    body.append("side_km", String(sideKm));
    return fetch(`/api/catalog/${encodeURIComponent(itemId)}/analyze`, {
      method: "POST",
      body,
    }).then(json<Analysis>);
  },
  examples: () => fetch("/api/examples").then(json<ExampleScene[]>),

  async analyzeExample(id: string, onPhase: (p: AnalyzePhase) => void): Promise<Analysis> {
    onPhase({ phase: "check" });
    const res = await fetch(`/api/examples/${encodeURIComponent(id)}/analyze?stream=true`, {
      method: "POST",
      headers: { Accept: "application/x-ndjson" },
    });
    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        /* ignore */
      }
      throw new Error(detailOf(body, res.statusText));
    }
    if (!res.body) throw new Error("La API no envió progreso de descarga");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let analysis: Analysis | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const event = JSON.parse(trimmed) as {
          phase: string;
          loaded?: number;
          total?: number;
          refreshed?: boolean;
          stale?: boolean;
          analysis?: Analysis;
          detail?: string;
        };
        if (event.phase === "check") {
          onPhase({ phase: "check", stale: event.stale });
        } else if (event.phase === "download") {
          onPhase({
            phase: "fetch",
            loaded: event.loaded ?? 0,
            total: Math.max(event.total ?? 1, 1),
            refreshed: event.refreshed,
          });
        } else if (event.phase === "infer") {
          onPhase({ phase: "infer" });
        } else if (event.phase === "done" && event.analysis) {
          analysis = event.analysis;
        } else if (event.phase === "error") {
          throw new Error(event.detail ?? "Error al analizar la escena oficial");
        }
      }
    }

    if (!analysis) throw new Error("La corrida terminó sin resultado");
    return analysis;
  },

  analyze(file: File, task: TaskId, onPhase: (p: AnalyzePhase) => void): Promise<Analysis> {
    return new Promise((resolve, reject) => {
      const body = new FormData();
      body.append("file", file);
      body.append("task", task);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/analyze");
      xhr.responseType = "json";
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onPhase({ phase: "upload", loaded: e.loaded, total: e.total });
      };
      xhr.upload.onload = () => onPhase({ phase: "infer" });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as Analysis);
        else reject(new Error(detailOf(xhr.response, `HTTP ${xhr.status}`)));
      };
      xhr.onerror = () => reject(new Error("Sin conexión con la API"));
      xhr.send(body);
    });
  },
};
