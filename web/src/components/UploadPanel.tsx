import { useState } from "react";
import type { TaskId, TaskInfo } from "../types";

interface Props {
  tasks: TaskInfo[];
  busy: boolean;
  onSubmit: (file: File, task: TaskId) => void;
}

export function UploadPanel({ tasks, busy, onSubmit }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [task, setTask] = useState<TaskId>("flood");

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        if (file) onSubmit(file, task);
      }}
    >
      <label>
        Tarea
        <select value={task} onChange={(e) => setTask(e.target.value as TaskId)} disabled={busy}>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        GeoTIFF (6 bandas Prithvi o Sentinel‑2 L1C)
        <input
          type="file"
          accept=".tif,.tiff,image/tiff"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <button type="submit" disabled={!file || busy}>
        {busy ? "Analizando…" : "Analizar"}
      </button>
      {busy && <p className="muted small">La primera vez descarga ~1.2 GB de pesos.</p>}
    </form>
  );
}
