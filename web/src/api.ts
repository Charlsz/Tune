import type { Analysis, ExampleScene, TaskId, TaskInfo } from "./types";

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
  | { phase: "fetch" }
  | { phase: "infer" };

export const api = {
  tasks: () => fetch("/api/tasks").then(json<TaskInfo[]>),
  analyses: (limit = 30) => fetch(`/api/analyses?limit=${limit}`).then(json<Analysis[]>),
  examples: () => fetch("/api/examples").then(json<ExampleScene[]>),

  analyzeExample(id: string, onPhase: (p: AnalyzePhase) => void): Promise<Analysis> {
    onPhase({ phase: "fetch" });
    return fetch(`/api/examples/${id}/analyze`, { method: "POST" }).then((res) => {
      onPhase({ phase: "infer" });
      return json<Analysis>(res);
    });
  },

  // XHR en vez de fetch: es la única forma de obtener progreso real de subida.
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
