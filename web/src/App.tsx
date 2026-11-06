import { useCallback, useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import type { AnalyzePhase } from "./api";
import { api } from "./api";
import { Enter } from "./components/shared/Enter";
import { NavBar } from "./components/shared/NavBar";
import { paths } from "./router/paths";
import type { Workspace } from "./router/workspace";
import type { Analysis, Place, TaskId, TaskInfo } from "./types";

function errorHint(message: string, context: string | null): string {
  const m = message.toLowerCase();
  if (m.includes("assertion") || m.includes("bandas") || m.includes("geotiff")) {
    return "Revisa que el archivo sea un GeoTIFF compatible (6 bandas Prithvi o Sentinel-2 L1C) o prueba una escena de ejemplo.";
  }
  if (m.includes("nubosidad") || m.includes("nubes")) {
    return "El % de la lista es de toda la escena (~100 km). Sube «Nubes máx.» al valor que indica el error, o elige otra fecha.";
  }
  if (context === "catalog" || m.includes("recorte") || m.includes("memoria")) {
    return "Prueba un recorte más pequeño (menos km), otra fecha, o una escena de ejemplo.";
  }
  if (context === "upload") {
    return "Comprueba el formato del archivo y vuelve a intentarlo. Si el archivo es muy grande, usa un recorte.";
  }
  return "Puedes reintentar, cambiar de escena o usar un ejemplo oficial desde Inicio.";
}

export function App() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [history, setHistory] = useState<Analysis[] | null>(null);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [pair, setPair] = useState<{ before: Analysis; after: Analysis } | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<AnalyzePhase | null>(null);
  const [runTask, setRunTask] = useState<TaskId | null>(null);
  const [runContext, setRunContext] = useState<string | null>(null);
  const [lastRunContext, setLastRunContext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);

  const refresh = useCallback(() => {
    const query = place ? { lat: place.lat, lon: place.lon } : {};
    api
      .analyses(query)
      .then(setHistory)
      .catch((e: Error) => {
        setError(e.message);
        setHistory((prev) => prev ?? []);
      });
  }, [place]);

  useEffect(() => {
    api
      .tasks()
      .then((list) => setTasks(list.filter((t) => t.id === "flood")))
      .catch((e: Error) => setError(e.message));
    refresh();
  }, [refresh]);

  function go(path: string) {
    if (window.location.pathname !== path) navigate(path);
  }

  async function run(
    task: TaskId,
    context: string,
    work: (onPhase: (p: AnalyzePhase) => void) => Promise<Analysis>,
  ) {
    setBusy(true);
    setError(null);
    setPhase(null);
    setRunTask(task);
    setRunContext(context);
    setLastRunContext(context);
    go(paths.analysis);
    setSummaryOpen(true);
    try {
      const a = await work(setPhase);
      setPair(null);
      setSelected(a);
      refresh();
    } catch (e) {
      const msg = (e as Error).message?.trim() || "Error desconocido durante el análisis.";
      setError(msg);
    } finally {
      setBusy(false);
      setPhase(null);
      setRunContext(null);
    }
  }

  function onAnalyze(file: File, task: TaskId) {
    return run(task, "upload", (onPhase) => api.analyze(file, task, onPhase));
  }

  function onExample(id: string, task: TaskId) {
    return run(task, "example", (onPhase) => api.analyzeExample(id, onPhase));
  }

  const firstRun = runTask != null && !(history ?? []).some((a) => a.task === runTask);

  function onCatalogAnalyze(
    itemId: string,
    task: TaskId,
    at: Place,
    sideKm: number,
    maxCloud: number,
  ) {
    return run(task, "catalog", (onPhase) =>
      api.catalogAnalyze(itemId, task, at, sideKm, maxCloud, onPhase),
    );
  }

  /** Atajo: analiza Antes y Después en serie y abre el par (inundación = agua nueva). */
  async function onCatalogComparePair(
    beforeItemId: string,
    afterItemId: string,
    at: Place,
    sideKm: number,
    maxCloud: number,
  ) {
    setBusy(true);
    setError(null);
    setPhase(null);
    setPair(null);
    setPlace(at);
    setRunTask("flood");
    setRunContext("catalog");
    setLastRunContext("catalog");
    go(paths.analysis);
    setSummaryOpen(true);
    try {
      setPhase({ phase: "prepare", detail: "Paso 1 de 2 · línea base (Antes)…" });
      const before = await api.catalogAnalyze(
        beforeItemId,
        "flood",
        at,
        sideKm,
        maxCloud,
        (p) => {
          if (p.phase === "prepare") {
            setPhase({ ...p, detail: p.detail ?? "Paso 1 de 2 · Antes" });
          } else if (p.phase === "infer") {
            setPhase({ ...p, detail: "Paso 1 de 2 · modelo en Antes…" });
          } else {
            setPhase(p);
          }
        },
      );
      setSelected(before);

      setPhase({ phase: "prepare", detail: "Paso 2 de 2 · fecha pico (Después)…" });
      const after = await api.catalogAnalyze(
        afterItemId,
        "flood",
        at,
        sideKm,
        maxCloud,
        (p) => {
          if (p.phase === "prepare") {
            setPhase({ ...p, detail: p.detail ?? "Paso 2 de 2 · Después" });
          } else if (p.phase === "infer") {
            setPhase({ ...p, detail: "Paso 2 de 2 · modelo en Después…" });
          } else {
            setPhase(p);
          }
        },
      );
      setPair({ before, after });
      setSelected(after);
      refresh();
    } catch (e) {
      const msg = (e as Error).message?.trim() || "Error desconocido durante la comparación.";
      setError(msg);
    } finally {
      setBusy(false);
      setPhase(null);
      setRunContext(null);
    }
  }

  async function onRemove(analysis: Analysis) {
    if (!window.confirm(`¿Quitar ${analysis.input_filename} del historial?`)) return;
    try {
      await api.remove(analysis.id);
      if (selected?.id === analysis.id) setSelected(null);
      if (pair && (pair.before.id === analysis.id || pair.after.id === analysis.id)) {
        setPair(null);
      }
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function openAnalysis(a: Analysis) {
    setPair(null);
    setSelected(a);
    setSummaryOpen(true);
    go(paths.analysis);
  }

  function openPair(before: Analysis, after: Analysis, at?: Place | null) {
    if (at) setPlace(at);
    setPair({ before, after });
    setSelected(after);
    setSummaryOpen(true);
    go(paths.analysis);
  }

  function clearPair() {
    setPair(null);
  }

  function closeSelected() {
    setSelected(null);
    setPair(null);
    setSummaryOpen(false);
  }

  const workspace: Workspace = {
    tasks,
    history,
    selected,
    pair,
    busy,
    phase,
    runContext,
    place,
    setPlace,
    summaryOpen,
    setSummaryOpen,
    firstRun,
    onAnalyze,
    onExample,
    onCatalogAnalyze,
    onCatalogComparePair: onCatalogComparePair,
    onRemove,
    openAnalysis,
    openPair,
    clearPair,
    closeSelected,
    goHome: () => go(paths.home),
  };

  return (
    <div className="app">
      <NavBar historyCount={history?.length ?? null} />

      <div className="workspace">
        {error && (
          <div className="banner-alert" role="alert">
            <div>
              <strong>No se pudo completar la acción</strong>
              <p>{error}</p>
              <p className="caption">{errorHint(error, lastRunContext)}</p>
            </div>
            <button type="button" className="close" onClick={() => setError(null)}>
              Cerrar
            </button>
          </div>
        )}

        <Enter>
          <Outlet context={workspace} />
        </Enter>
      </div>
    </div>
  );
}
