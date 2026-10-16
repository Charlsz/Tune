import { useEffect, useRef, useState } from "react";
import { type AnalyzePhase, api } from "../api";
import { formatRemain, remainingSeconds } from "../lib/eta";
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

function etaHint(scene: ExampleScene, firstFlood: boolean): string {
  const mb = (scene.size_bytes / (1024 * 1024)).toFixed(1);
  if (scene.cached) {
    return firstFlood
      ? "En disco · al usar se busca actualización · 1.ª corrida del modelo: varios min"
      : "En disco · al usar se busca actualización en Hugging Face";
  }
  if (firstFlood) {
    return `Imagen ${mb} MB + pesos ~1,2 GB la 1.ª vez · se actualiza si HF cambió`;
  }
  return `Imagen ${mb} MB · se verifica actualización al usar`;
}

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
  }, [busy]);

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
          <p className="caption">Escenas oficiales de prueba</p>
          <p className="caption examples-hint">
            Cada vez que pulsas una escena, Tune consulta Hugging Face: si el archivo cambió, lo
            vuelve a bajar y luego analiza. El tamaño (~2 MB) es solo la imagen; la primera corrida
            del modelo puede tardar varios minutos.
          </p>
          {shown.map((s) => (
            <button
              key={s.id}
              type="button"
              className="example-card"
              disabled={busy}
              onClick={() => onExample(s.id, s.task)}
            >
              <span className="example-main">
                <span className="example-title">{s.label}</span>
                {s.blurb && <span className="muted example-blurb">{s.blurb}</span>}
                <span className="muted example-eta">{etaHint(s, firstRun && task === "flood")}</span>
              </span>
              <span className="example-meta">
                <span className="num">{fmt.bytes(s.size_bytes)}</span>
                {s.cached ? (
                  <span className="pill">En disco</span>
                ) : (
                  <span className="pill soft">Remota</span>
                )}
              </span>
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
        <input
          ref={input}
          type="file"
          accept=".tif,.tiff,image/tiff"
          hidden
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <span className="ellipsis">{file ? file.name : "O elige tu GeoTIFF"}</span>
        <span className="muted">
          {file ? fmt.bytes(file.size) : "6 bandas Prithvi o Sentinel-2 L1C, hasta 200 MB"}
        </span>
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
  const [phaseStarted, setPhaseStarted] = useState(() => Date.now());
  const [phaseKey, setPhaseKey] = useState<string>("");
  const [now, setNow] = useState(t0);
  const budget = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const key = phase?.phase ?? "idle";
    if (key !== phaseKey) {
      setPhaseKey(key);
      setPhaseStarted(Date.now());
      if (key === "infer" || key === "check") {
        // reinicia presupuesto al entrar en análisis / chequeo
        if (key === "infer") budget.current = 0;
      }
    }
  }, [phase, phaseKey]);

  const elapsedS = (now - t0) / 1000;
  const phaseElapsedS = (now - phaseStarted) / 1000;
  const uploading = phase?.phase === "upload";
  const checking = phase?.phase === "check";
  const fetching = phase?.phase === "fetch";
  const inferring = phase?.phase === "infer" || (!phase && !uploading && !checking && !fetching);

  let pct = 0;
  if (uploading && phase.total > 0) pct = Math.min(1, phase.loaded / phase.total);
  else if (fetching && phase.total > 0) pct = Math.min(1, phase.loaded / phase.total);

  const etaPhase =
    uploading || fetching
      ? { phase: phase.phase as "upload" | "fetch", loaded: phase.loaded, total: phase.total }
      : { phase: (phase?.phase === "check" ? "check" : inferring ? "infer" : null) as "check" | "infer" | null };

  const remain = remainingSeconds(etaPhase, elapsedS, phaseElapsedS, firstRun, budget);

  const title = uploading
    ? "Subiendo archivo"
    : checking
      ? phase?.phase === "check" && phase.stale === false
        ? "Escena al día · preparando análisis"
        : "Buscando actualización en Hugging Face"
      : fetching
        ? phase.refreshed === false
          ? "Escena lista (sin cambios)"
          : "Bajando escena oficial"
        : firstRun
          ? "Descargando pesos y analizando"
          : "Analizando con Prithvi";

  const determinate = uploading || (fetching && pct < 0.999);
  const right = determinate
    ? `${Math.round(pct * 100)}% · ${fmt.secs(elapsedS)} · quedan ${formatRemain(remain)}`
    : `${fmt.secs(elapsedS)} · quedan ${formatRemain(remain)}`;

  return (
    <div className="progress" aria-live="polite">
      <div className="progress-row">
        <span>{title}</span>
        <span className="num muted">{right}</span>
      </div>
      <div className={`track ${determinate ? "" : "indeterminate"}`}>
        <i style={determinate ? { width: `${pct * 100}%` } : undefined} />
      </div>
      {fetching && (
        <p className="caption">
          {fmt.bytes(phase.loaded)} de {fmt.bytes(phase.total)} · transcurridos {fmt.secs(elapsedS)} ·
          faltan ~{formatRemain(remain)} para terminar
        </p>
      )}
      {checking && (
        <p className="caption">
          Comprueba si hay una versión nueva de la escena. Luego baja solo si cambió.
        </p>
      )}
      {inferring && (
        <p className="caption">
          {firstRun
            ? "Primera vez: puede bajar ~1,2 GB de pesos. El tiempo restante se actualiza en vivo."
            : "El modelo está corriendo. El tiempo restante se ajusta según el ritmo real."}{" "}
          Faltan ~{formatRemain(remain)}.
        </p>
      )}
    </div>
  );
}
