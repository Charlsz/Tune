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
      .then(setTasks)
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

  async function onRemove(analysis: Analysis) {
    if (!window.confirm(`¿Quitar ${analysis.input_filename} del historial?`)) return;
    try {
      await api.remove(analysis.id);
      if (selected?.id === analysis.id) setSelected(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function openAnalysis(a: Analysis) {
    setSelected(a);
    setSummaryOpen(true);
    go(paths.analysis);
  }

  function closeSelected() {
    setSelected(null);
    setSummaryOpen(false);
  }

  const workspace: Workspace = {
    tasks,
    history,
    selected,
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
    onRemove,
    openAnalysis,
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
