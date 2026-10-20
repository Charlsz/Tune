import type {
  Analysis,
  CatalogLimits,
  CatalogScene,
  ExampleScene,
  Place,
  SeriesPoint,
  TaskId,
  TaskInfo,
} from "./types";
import { readAnalyzeNdjson } from "./lib/ndjsonAnalyze";

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
  | { phase: "prepare"; detail?: string }
  | { phase: "upload"; loaded: number; total: number }
  | { phase: "check"; stale?: boolean }
  | { phase: "fetch"; loaded: number; total: number; refreshed?: boolean }
  | { phase: "infer"; detail?: string };

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
  timelineSeries(q: { analysisId?: string; lat?: number; lon?: number; task?: TaskId }) {
    const p = new URLSearchParams();
    if (q.analysisId) p.set("analysis_id", q.analysisId);
    if (q.lat != null) p.set("lat", String(q.lat));
    if (q.lon != null) p.set("lon", String(q.lon));
    if (q.task) p.set("task", q.task);
    return fetch(`/api/timeline/series?${p}`).then(json<SeriesPoint[]>);
  },
  async remove(id: string) {
    const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" });
    if (res.status === 204) return;
    await json(res);
  },
  catalogLimits: () => fetch("/api/catalog/limits").then(json<CatalogLimits>),
  catalogSearch(
    q: {
      lat: number;
      lon: number;
      start: string;
      end: string;
      maxCloud?: number;
      sideKm?: number;
    },
    signal?: AbortSignal,
  ) {
    const p = new URLSearchParams({
      lat: String(q.lat),
      lon: String(q.lon),
      start: q.start,
      end: q.end,
      max_cloud: String(q.maxCloud ?? 40),
      side_km: String(q.sideKm ?? 20),
    });
    return fetch(`/api/catalog/search?${p}`, { signal }).then(json<CatalogScene[]>);
  },
  geocode(q: string, signal?: AbortSignal) {
    const p = new URLSearchParams({ q });
    return fetch(`/api/geocode?${p}`, { signal }).then(
      json<{ label: string; lat: number; lon: number }[]>,
    );
  },

  async catalogAnalyze(
    itemId: string,
    task: TaskId,
    place: Place,
    sideKm: number,
    maxCloud: number,
    onPhase?: (p: AnalyzePhase) => void,
  ): Promise<Analysis> {
    onPhase?.({ phase: "prepare", detail: "Preparando descarga del catálogo…" });
    const body = new FormData();
    body.append("task", task);
    body.append("lat", String(place.lat));
    body.append("lon", String(place.lon));
    body.append("side_km", String(sideKm));
    body.append("max_cloud", String(maxCloud));
    const res = await fetch(
      `/api/catalog/${encodeURIComponent(itemId)}/analyze?stream=true`,
      {
        method: "POST",
        body,
        headers: { Accept: "application/x-ndjson" },
      },
    );
    if (!res.ok) {
      let errBody: unknown = null;
      try {
        errBody = await res.json();
      } catch {
        /* ignore */
      }
      throw new Error(detailOf(errBody, res.statusText));
    }
    if (!res.body) throw new Error("La API no envió progreso de descarga");

    return readAnalyzeNdjson(res.body, (event) => {
      if (event.phase === "download") {
        onPhase?.({
          phase: "fetch",
          loaded: event.loaded ?? 0,
          total: Math.max(event.total ?? 1, 1),
          refreshed: true,
        });
      } else if (event.phase === "infer") {
        onPhase?.({
          phase: "infer",
          detail: "Bandas listas. Ejecutando el modelo…",
        });
      }
    });
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

    return readAnalyzeNdjson(res.body, (event) => {
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
      }
    });
  },

  analyze(file: File, task: TaskId, onPhase: (p: AnalyzePhase) => void): Promise<Analysis> {
    return new Promise((resolve, reject) => {
      onPhase({
        phase: "prepare",
        detail: `Preparando ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
      });
      const body = new FormData();
      body.append("file", file);
      body.append("task", task);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/analyze");
      xhr.responseType = "json";
      xhr.upload.onloadstart = () =>
        onPhase({ phase: "upload", loaded: 0, total: Math.max(file.size, 1) });
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onPhase({ phase: "upload", loaded: e.loaded, total: e.total });
      };
      xhr.upload.onload = () =>
        onPhase({
          phase: "infer",
          detail: "Archivo recibido. Validando bandas y ejecutando el modelo…",
        });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as Analysis);
        else reject(new Error(detailOf(xhr.response, `HTTP ${xhr.status}`)));
      };
      xhr.onerror = () =>
        reject(new Error("Sin conexión con el servicio. Comprueba que Tune esté en marcha."));
      xhr.send(body);
    });
  },
};
