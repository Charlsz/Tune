import { useEffect, useRef, useState } from "react";
import { type AnalyzePhase, api } from "../api";
import { fmt, TASK_META } from "../lib/insights";
import type { ExampleScene, TaskId, TaskInfo } from "../types";

interface Props {
  tasks: TaskInfo[];
  busy: boolean;
  phase: AnalyzePhase | null;
  firstRun: boolean;
  onSubmit: (file: File, task: TaskId) => void;
  onExample: (id: string, task: TaskId) => void;
}

const ORDER: TaskId[] = ["flood", "burn_scar"];

export function UploadPanel({ tasks, busy, phase, firstRun, onSubmit, onExample }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [task, setTask] = useState<TaskId>("flood");
  const [drag, setDrag] = useState(false);
  const [examples, setExamples] = useState<ExampleScene[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const model = tasks.find((t) => t.id === task)?.model_id;
  const shown = examples.filter((s) => s.task === task);

  useEffect(() => {
    api.examples().then(setExamples).catch(() => setExamples([]));
  }, []);

  function pick(f: File | undefined) {
    if (f && /\.tiff?$/i.test(f.name)) setFile(f);
  }

  return (
    <form
      className="section"
      onSubmit={(e) => {
        e.preventDefault();
        if (file) onSubmit(file, task);
      }}
    >
      <h2>Nuevo análisis</h2>
      <div className="choice" role="radiogroup" aria-label="Tarea">
        {ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={task === id}
            disabled={busy}
            onClick={() => setTask(id)}
          >
            {TASK_META[id].name}
          </button>
        ))}
      </div>
      <p className="caption">
        {model ? (
          <a href={`https://huggingface.co/${model}`} target="_blank" rel="noreferrer">
            {model.split("/")[1]}
          </a>
        ) : (
          "Cargando modelo"
        )}{" "}
        · entrenado en {TASK_META[task].dataset}
      </p>

      {shown.length > 0 && (
        <div className="examples">
          <p className="caption">O prueba una escena oficial</p>
          {shown.map((s) => (
            <button key={s.id} type="button" disabled={busy} onClick={() => onExample(s.id, s.task)}>
              <span>{s.label}</span>
              <span className="muted num">{fmt.bytes(s.size_bytes)}</span>
            </button>
          ))}
        </div>
      )}

      <div
        className={`drop ${drag ? "drag" : ""} ${file ? "has" : ""}`}
        onClick={() => !busy && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!busy) pick(e.dataTransfer.files[0]);
        }}
      >
        <input ref={input} type="file" accept=".tif,.tiff,image/tiff" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <span className="ellipsis">{file ? file.name : "O elige tu GeoTIFF"}</span>
        <span className="muted">{file ? fmt.bytes(file.size) : "6 bandas Prithvi o Sentinel-2 L1C, hasta 200 MB"}</span>
      </div>

      {busy ? (
        <Progress phase={phase} firstRun={firstRun} />
      ) : (
        <button className="primary" type="submit" disabled={!file}>
          Analizar
        </button>
      )}
    </form>
  );
}

function Progress({ phase, firstRun }: { phase: AnalyzePhase | null; firstRun: boolean }) {
  const [t0] = useState(() => Date.now());
  const [now, setNow] = useState(t0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const uploading = !phase || phase.phase === "upload";
  const fetching = phase?.phase === "fetch";
  const pct = phase?.phase === "upload" && phase.total ? phase.loaded / phase.total : 0;

  return (
    <div className="progress" aria-live="polite">
      <div className="progress-row">
        <span>
          {uploading
            ? "Subiendo"
            : fetching
              ? "Bajando escena"
              : firstRun
                ? "Descargando pesos y analizando"
                : "Analizando"}
        </span>
        <span className="num muted">{uploading ? `${Math.round(pct * 100)}%` : `${((now - t0) / 1000).toFixed(1)} s`}</span>
      </div>
      <div className={`track ${uploading ? "" : "indeterminate"}`}>
        <i style={uploading ? { width: `${pct * 100}%` } : undefined} />
      </div>
      {firstRun && !uploading && !fetching && <p className="caption">Solo la primera vez: ~1,2 GB desde Hugging Face.</p>}
    </div>
  );
}
