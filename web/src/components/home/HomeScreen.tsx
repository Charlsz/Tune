import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { api } from "../../api";
import { geotiffHints, validateGeotiffFile } from "../../lib/geotiffFile";
import { findByDate } from "../../lib/pair";
import { fmt, TASK_META } from "../../lib/insights";
import { paths } from "../../router/paths";
import type { Analysis, ExampleScene, Place, TaskInfo } from "../../types";
import { CompareFloodCatalog } from "./CompareFloodCatalog";

const CACHED_DEMOS: {
  id: string;
  label: string;
  place: Place;
  beforeDay: string;
  afterDay: string;
  blurb: string;
}[] = [
  {
    id: "sindh",
    label: "Sindh 2022",
    place: { lat: 27.7, lon: 68.85 },
    beforeDay: "2022-05-18",
    afterDay: "2022-09-05",
    blurb: "Crecida documentada · agua nueva vs río",
  },
  {
    id: "magdalena",
    label: "Magdalena 2022",
    place: { lat: 8.85, lon: -74.65 },
    beforeDay: "2022-02-22",
    afterDay: "2022-05-08",
    blurb: "Seca → húmeda · baseline local",
  },
  {
    id: "mississippi",
    label: "Mississippi 2019",
    place: { lat: 37.0, lon: -89.18 },
    beforeDay: "2018-09-18",
    afterDay: "2019-06-10",
    blurb: "Permanente estable + lámina nueva",
  },
];

interface Props {
  tasks: TaskInfo[];
  busy: boolean;
  firstRun: boolean;
  place: Place | null;
  history: Analysis[] | null;
  onPlace: (place: Place | null) => void;
  onSubmit: (file: File) => void;
  onExample: (id: string) => void;
  onCatalogAnalyze: (
    itemId: string,
    at: Place,
    sideKm: number,
    maxCloud: number,
  ) => void;
  onOpenPair: (before: Analysis, after: Analysis, at?: Place | null) => void;
}

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
  history,
  onPlace,
  onSubmit,
  onExample,
  onCatalogAnalyze,
  onOpenPair,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileHints, setFileHints] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [examples, setExamples] = useState<ExampleScene[]>([]);
  const [pickedExample, setPickedExample] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const floodTask = tasks.find((t) => t.id === "flood");
  const model = floodTask?.model_id;
  const shown = examples.filter((s) => s.task === "flood");
  const preview = shown.find((s) => s.id === pickedExample) ?? null;

  useEffect(() => {
    let cancelled = false;
    api
      .examples()
      .then((list) => {
        if (!cancelled) setExamples(list.filter((s) => s.task === "flood"));
      })
      .catch(() => {
        if (!cancelled) setExamples([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      onSubmit(file);
      return;
    }
    if (pickedExample) onExample(pickedExample);
  }

  const canStart = Boolean(file || pickedExample);
  const [pairMsg, setPairMsg] = useState<string | null>(null);
  const [pairBusy, setPairBusy] = useState(false);

  async function openCached(demo: (typeof CACHED_DEMOS)[number]) {
    setPairMsg(null);
    setPairBusy(true);
    onPlace(demo.place);
    try {
      const list = await api.analyses({
        lat: demo.place.lat,
        lon: demo.place.lon,
        task: "flood",
        limit: 50,
      });
      const before = findByDate(list, demo.beforeDay);
      const after = findByDate(list, demo.afterDay);
      if (!before || !after) {
        setPairMsg(
          `${demo.label}: aún no hay par guardado aquí. Usa el atajo verificado abajo, analiza Antes y Luego Después (una vez), y este botón abrirá el resultado al instante.`,
        );
        return;
      }
      onOpenPair(before, after, demo.place);
    } catch (e) {
      setPairMsg((e as Error).message);
    } finally {
      setPairBusy(false);
    }
  }

  return (
    <div
      className={`home home-compare${drag ? " is-file-drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDrag(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (!busy) pick(e.dataTransfer.files[0]);
      }}
    >
      <header className="page-head">
        <h1>Detecta inundación comparando Antes y Después</h1>
        <p className="page-lead">
          El modelo ve agua. Tune marca inundación solo donde el agua es{" "}
          <strong>nueva</strong> respecto a la fecha Antes. Elige el mismo punto, una escena
          anterior y otra posterior.
        </p>
      </header>

      <p className="home-tip callout">
        Flujo: <strong>1 · Analizar Antes</strong> → vuelve a Inicio →{" "}
        <strong>2 · Analizar Después</strong>. Luego verás <strong>Antes | Después</strong> juntos:
        la inundación es el agua nueva (rojo), no el río entero. Guía en{" "}
        <Link to={paths.howToUse}>How to use</Link>.
      </p>

      <div className="home-card">
        <p className="caption home-model">
          {model ? (
            <a href={`https://huggingface.co/${model}`} target="_blank" rel="noreferrer">
              {model.split("/")[1]}
            </a>
          ) : (
            "Cargando modelo"
          )}{" "}
          · {TASK_META.flood.dataset}
        </p>

        <section className="home-block">
          <h2>Resultados listos (sin recalcular)</h2>
          <p className="caption">
            Si ya corriste el par en esta instalación, ábrelo al instante y compara las dos fechas.
            Ideal para demos y feria.
          </p>
          <div className="presets demo-presets cached-demos">
            {CACHED_DEMOS.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={busy || pairBusy}
                title={d.blurb}
                onClick={() => void openCached(d)}
              >
                {d.label}
              </button>
            ))}
          </div>
          {pairMsg && <p className="caption catalog-error">{pairMsg}</p>}
        </section>

        <section className="home-block">
          <h2>1 · Lugar y comparación Antes / Después</h2>
          <p className="caption">
            Las fechas de cada columna vienen del catálogo Sentinel-2. Usa un par verificado o
            elige tus propios rangos; la app recuerda la selección al volver del análisis.
          </p>
          <CompareFloodCatalog
            place={place}
            busy={busy}
            history={history}
            onPlace={onPlace}
            onAnalyze={onCatalogAnalyze}
          />
        </section>

        <section className="home-block">
          <button
            type="button"
            className="advanced-toggle"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            {advancedOpen ? "Ocultar" : "Mostrar"} · GeoTIFF propio o escena de ejemplo
          </button>
          {advancedOpen && (
            <>
              <p className="caption">
                Alternativa sin catálogo. Un solo GeoTIFF no demuestra inundación: hace falta un
                Antes del mismo sitio (historial).
              </p>
              <div className="home-inputs">
                <button
                  type="button"
                  className={`input-tile${file ? " selected" : ""}${fileError ? " has-error" : ""}`}
                  disabled={busy}
                  onClick={() => !busy && input.current?.click()}
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
                    <span className="input-tile-desc">No hay escenas oficiales de inundación.</span>
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
                              <span className="muted example-eta">{etaHint(s, firstRun)}</span>
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
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
