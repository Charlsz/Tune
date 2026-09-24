import { useEffect, useRef, useState } from "react";
import type { AnalyzePhase } from "../api";
import { fmt, TASK_META } from "../lib/insights";
import type { TaskId, TaskInfo } from "../types";

interface Props {
  tasks: TaskInfo[];
  busy: boolean;
  phase: AnalyzePhase | null;
  firstRun: boolean;
  onSubmit: (file: File, task: TaskId) => void;
}

const ORDER: TaskId[] = ["flood", "burn_scar"];

export function UploadPanel({ tasks, busy, phase, firstRun, onSubmit }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [task, setTask] = useState<TaskId>("flood");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const model = tasks.find((t) => t.id === task)?.model_id;

  function pick(f: File | undefined) {
    if (f && /\.tiff?$/i.test(f.name)) setFile(f);
  }

  return (
    <form
      className="block"
      onSubmit={(e) => {
        e.preventDefault();
        if (file) onSubmit(file, task);
      }}
    >
      <div className="segmented" role="radiogroup" data-index={ORDER.indexOf(task)}>
        <span className="segmented-pill" aria-hidden />
        {ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={task === id}
            disabled={busy}
            onClick={() => setTask(id)}
          >
            <i className="dot" style={{ background: TASK_META[id].accent }} />
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
        )}
        <span> · {TASK_META[task].dataset}</span>
      </p>

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
        <span className="drop-title">{file ? file.name : "Suelta un GeoTIFF o haz clic"}</span>
        <span className="drop-meta">{file ? fmt.bytes(file.size) : "6 bandas Prithvi o Sentinel-2 L1C · hasta 200 MB"}</span>
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
  const pct = phase?.phase === "upload" && phase.total ? phase.loaded / phase.total : 0;

  return (
    <div className="progress" aria-live="polite">
      <div className="progress-row">
        <span>{uploading ? "Subiendo escena" : firstRun ? "Descargando pesos y analizando" : "Analizando"}</span>
        <span className="num muted">{uploading ? `${Math.round(pct * 100)}%` : `${((now - t0) / 1000).toFixed(1)} s`}</span>
      </div>
      <div className={`track ${uploading ? "" : "indeterminate"}`}>
        <i style={uploading ? { width: `${pct * 100}%` } : undefined} />
      </div>
      {firstRun && !uploading && <p className="caption">Solo la primera vez: ~1,2 GB desde Hugging Face.</p>}
    </div>
  );
}
