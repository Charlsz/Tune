import type { Analysis, TaskId, TaskInfo } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json() as Promise<T>;
}

export const api = {
  tasks: () => fetch("/api/tasks").then(json<TaskInfo[]>),
  analyses: (limit = 30) => fetch(`/api/analyses?limit=${limit}`).then(json<Analysis[]>),
  analyze(file: File, task: TaskId) {
    const body = new FormData();
    body.append("file", file);
    body.append("task", task);
    return fetch("/api/analyze", { method: "POST", body }).then(json<Analysis>);
  },
};
