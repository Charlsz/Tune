import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { geotiffHints, validateGeotiffFile } from "../lib/geotiffFile";
import { fmt, TASK_META } from "../lib/insights";
import type { ExampleScene, Place, TaskId, TaskInfo } from "../types";
import { LocationCatalog } from "./LocationCatalog";

interface Props {
  tasks: TaskInfo[];
  busy: boolean;
  firstRun: boolean;
  place: Place | null;
  onPlace: (place: Place | null) => void;
  onSubmit: (file: File, task: TaskId) => void;
  onExample: (id: string, task: TaskId) => void;
  onCatalogAnalyze: (
    itemId: string,
    task: TaskId,
    at: Place,
    sideKm: number,
    maxCloud: number,
  ) => void;
}

const ORDER: TaskId[] = ["flood", "burn_scar"];

function etaHint(scene: ExampleScene, firstFlood: boolean): string {
  const mb = (scene.size_bytes / (1024 * 1024)).toFixed(1);
  if (scene.cached) {
    return firstFlood
      ? "En disco · 1.ª corrida del modelo: varios min"
      : "En disco · se verifica actualización al usar";
  }
  if (firstFlood) {
    return `Imagen ${mb} MB + pesos ~1,2 GB la 1.ª vez`;
  }
  return `Imagen ${mb} MB · se verifica actualización al usar`;
}

export function HomeScreen({
  tasks,
  busy,
  firstRun,
  place,
  onPlace,
  onSubmit,
  onExample,
  onCatalogAnalyze,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileHints, setFileHints] = useState<string[]>([]);
  const [task, setTask] = useState<TaskId>("flood");
  const [drag, setDrag] = useState(false);
  const [examples, setExamples] = useState<ExampleScene[]>([]);
  const [pickedExample, setPickedExample] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const model = tasks.find((t) => t.id === task)?.model_id;
  const shown = examples.filter((s) => s.task === task);
  const preview = shown.find((s) => s.id === pickedExample) ?? null;

  useEffect(() => {
    let cancelled = false;
    api
      .examples()
      .then((list) => {
        if (!cancelled) setExamples(list);
      })
      .catch(() => {
        if (!cancelled) setExamples([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPickedExample(null);
    setFile(null);
    setFileError(null);
    setFileHints([]);
  }, [task]);

  function pick(f: File | undefined) {
    if (!f) return;
    const check = validateGeotiffFile(f);
    if (!check.ok) {
      setFile(null);
      setFileError(check.error);
      setFileHints([]);
      setPickedExample(null);
      return;
    }
    setFileError(null);
    setFile(f);
    setFileHints(geotiffHints(f));
    setPickedExample(null);
  }

  function startAnalysis() {
    if (file) {
      const check = validateGeotiffFile(file);
      if (!check.ok) {
        setFileError(check.error);
        return;
      }
      onSubmit(file, task);
      return;
    }
    if (pickedExample) {
      const scene = shown.find((s) => s.id === pickedExample);
      if (scene) onExample(scene.id, scene.task);
    }
  }

  const canStart = Boolean(file || pickedExample);

  return (
    <div className="home">
      <header className="page-head">
        <h1>Analiza zonas afectadas por inundaciones o incendios</h1>
        <p className="page-lead">
          Elige coordenadas y una escena Sentinel-2, sube tu GeoTIFF, o usa un ejemplo oficial. La
          inundación se estima como agua nueva, no como toda el agua detectada.
        </p>
      </header>

      <div className="home-card">
        <div className="seg" role="radiogroup" aria-label="Tipo de análisis">
          {ORDER.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={task === id}
              className={task === id ? "on" : undefined}
              disabled={busy}
              onClick={() => setTask(id)}
            >
              {id === "flood" ? "Inundaciones" : "Incendios"}
            </button>
          ))}
        </div>

        <p className="caption home-model">
          {model ? (
            <a href={`https://huggingface.co/${model}`} target="_blank" rel="noreferrer">
              {model.split("/")[1]}
            </a>
          ) : (
            "Cargando modelo"
          )}{" "}
          · {TASK_META[task].dataset}
        </p>

        <section className="home-block">
          <h2>
            1 ·{" "}
            {task === "flood"
              ? "Ubicación y escenas Sentinel-2"
              : "Ubicación (catálogo solo para inundación)"}
          </h2>
          <p className="caption">
            {task === "flood"
              ? "Indica un punto, revisa la lista de escenas y pulsa Analizar. El progreso (bandas e inferencia) aparece en la vista Análisis."
              : "Puedes fijar un punto para el historial del lugar. El análisis de incendio se hace con GeoTIFF HLS o un ejemplo oficial."}
          </p>
          <LocationCatalog
            place={place}
            busy={busy}
            task={task}
            onPlace={onPlace}
            onAnalyze={onCatalogAnalyze}
          />
        </section>

        <section className="home-block">
          <h2>2 · GeoTIFF propio o escena de ejemplo</h2>
          <div className="home-inputs">
            <button
              type="button"
              className={`input-tile${file ? " selected" : ""}${fileError ? " has-error" : ""}`}
              disabled={busy}
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
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <span className="input-tile-title">Subir GeoTIFF</span>
              <span className="input-tile-desc">
                {file
                  ? `${file.name} · ${fmt.bytes(file.size)}`
                  : drag
                    ? "Suelta el archivo aquí"
                    : "Arrastra o elige .tif / .tiff · hasta 200 MB · 6 bandas Prithvi o Sentinel-2 L1C"}
              </span>
            </button>

            <div className={`input-tile example-tile${pickedExample && !file ? " selected" : ""}`}>
              <span className="input-tile-title">Escena de ejemplo</span>
              {shown.length === 0 ? (
                <span className="input-tile-desc">
                  No hay escenas oficiales para esta tarea.
                </span>
              ) : (
                <ul className="example-pick">
                  {shown.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={pickedExample === s.id && !file ? "on" : undefined}
                        disabled={busy}
                        onClick={() => {
                          setPickedExample(s.id);
                          setFile(null);
                          setFileError(null);
                          setFileHints([]);
                        }}
                      >
                        <span className="example-main">
                          <span className="example-title">{s.label}</span>
                          {s.blurb && <span className="muted example-blurb">{s.blurb}</span>}
                          <span className="muted example-eta">
                            {etaHint(s, firstRun && task === "flood")}
                          </span>
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
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {fileError && <p className="caption catalog-error">{fileError}</p>}
          {file && fileHints.length > 0 && (
            <ul className="file-hints">
              {fileHints.map((h) => (
                <li key={h} className="caption">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {preview && !file && (
            <p className="caption home-preview-note">
              Seleccionada: <strong>{preview.label}</strong>
              {preview.blurb ? ` · ${preview.blurb}` : ""}
            </p>
          )}

          <div className="home-actions">
            <button
              type="button"
              className="primary wide"
              disabled={!canStart || busy}
              onClick={startAnalysis}
            >
              Analizar zona
            </button>
            {!canStart && (
              <p className="caption">
                También puedes analizar una escena de la lista de arriba sin usar este botón.
              </p>
            )}
            {busy && (
              <p className="caption">Análisis en curso. El progreso detallado está en Análisis.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
