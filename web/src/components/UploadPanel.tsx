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

  function pick(f: File | undefined) {
    if (f && /\.tiff?$/i.test(f.name)) setFile(f);
  }

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (file) onSubmit(file, task);
      }}
    >
      <div className="eyebrow">01 · Tarea</div>
      <div className="segmented" role="radiogroup">
        {ORDER.map((id) => {
          const info = tasks.find((t) => t.id === id);
          const meta = TASK_META[id];
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={task === id}
              className={`seg ${task === id ? "on" : ""}`}
              style={{ "--accent": meta.accent } as React.CSSProperties}
              disabled={busy}
              onClick={() => setTask(id)}
            >
              <span className="seg-code">{meta.code}</span>
              <span className="seg-name">{meta.name}</span>
              <span className="seg-model">{info?.model_id.split("/")[1] ?? "…"}</span>
            </button>
          );
        })}
      </div>

      <div className="eyebrow">02 · Escena</div>
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
        <input
          ref={input}
          type="file"
          accept=".tif,.tiff,image/tiff"
          hidden
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {file ? (
          <>
            <span className="drop-name">{file.name}</span>
            <span className="drop-meta">{fmt.bytes(file.size)} · GeoTIFF</span>
          </>
        ) : (
          <>
            <span className="drop-name">Arrastra un GeoTIFF</span>
            <span className="drop-meta">6 bandas Prithvi o Sentinel-2 L1C · máx. 200 MB</span>
          </>
        )}
      </div>

      <button className="cta" type="submit" disabled={!file || busy}>
        {busy ? "En curso" : "Ejecutar análisis"}
      </button>

      {busy && <RunStatus phase={phase} firstRun={firstRun} />}
    </form>
  );
}

function RunStatus({ phase, firstRun }: { phase: AnalyzePhase | null; firstRun: boolean }) {
  const [t0] = useState(() => Date.now());
  const [now, setNow] = useState(t0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const elapsed = (now - t0) / 1000;
  const uploading = !phase || phase.phase === "upload";
  const pct = phase?.phase === "upload" && phase.total ? phase.loaded / phase.total : 1;

  return (
    <div className="run">
      <div className="run-head">
        <span className="pulse" />
        <span>T+ {elapsed.toFixed(1)} s</span>
      </div>
      <ol className="stages">
        <li className={uploading ? "active" : "done"}>
          <span>Subida</span>
          <span className="num">{Math.round(pct * 100)}%</span>
        </li>
        <li className={uploading ? "" : "active"}>
          <span>{firstRun ? "Pesos + inferencia" : "Inferencia 512×512"}</span>
          <span className="num">{uploading ? "—" : "GPU/CPU"}</span>
        </li>
        <li>
          <span>Máscara + persistencia</span>
          <span className="num">—</span>
        </li>
      </ol>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${uploading ? pct * 33 : 33}%` }} />
        {!uploading && <div className="bar-scan" />}
      </div>
      {firstRun && !uploading && (
        <p className="hint">Primera corrida de esta tarea: descarga ~1,2 GB de pesos una sola vez.</p>
      )}
    </div>
  );
}
