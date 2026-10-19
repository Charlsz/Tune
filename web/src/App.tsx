import { useCallback, useEffect, useState } from "react";
import { type AnalyzePhase, api } from "./api";
import { AnalysisList } from "./components/AnalysisList";
import { AnalyzeProgress } from "./components/AnalyzeProgress";
import { DocsScreen } from "./components/DocsScreen";
import { HomeScreen } from "./components/HomeScreen";
import { SceneStage } from "./components/SceneStage";
import { type NavId, Sidebar } from "./components/Sidebar";
import { StatsCard } from "./components/StatsCard";
import { Timeline } from "./components/Timeline";
import type { Analysis, Place, TaskId, TaskInfo } from "./types";

function navFromPath(): NavId {
  return window.location.pathname.startsWith("/docs") ? "docs" : "home";
}

function pathForNav(id: NavId): string {
  return id === "docs" ? "/docs" : "/";
}

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
  const [nav, setNav] = useState<NavId>(navFromPath);
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

  useEffect(() => {
    const onPop = () => setNav(navFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(id: NavId) {
    setNav(id);
    const next = pathForNav(id);
    if (window.location.pathname !== next) {
      window.history.pushState(null, "", next);
    }
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
    navigate("analysis");
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
    navigate("analysis");
  }

  return (
    <div className="app">
      <Sidebar active={nav} onNavigate={navigate} historyCount={history?.length ?? null} />

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

        {nav === "home" && (
          <main className="page">
            <HomeScreen
              tasks={tasks}
              busy={busy}
              firstRun={firstRun}
              place={place}
              onPlace={setPlace}
              onSubmit={onAnalyze}
              onExample={onExample}
              onCatalogAnalyze={onCatalogAnalyze}
            />
          </main>
        )}

        {nav === "analysis" && (
          <div className="analysis-layout">
            <div className="view">
              <SceneStage
                analysis={selected}
                tasks={tasks}
                busy={busy}
                onGoHome={() => navigate("home")}
              />
              {(place || (selected && !busy)) && (
                <Timeline analysis={selected} place={place} onSelect={openAnalysis} />
              )}
            </div>
            {(busy || (selected && !busy)) && (
              <aside className={`summary-dock${summaryOpen || busy ? "" : " collapsed"}`}>
                {!busy && (
                  <button
                    type="button"
                    className="summary-toggle"
                    aria-expanded={summaryOpen}
                    onClick={() => setSummaryOpen((o) => !o)}
                  >
                    {summaryOpen ? "Ocultar resumen" : "Mostrar resumen"}
                  </button>
                )}
                {busy && (
                  <div className="summary-busy">
                    <p className="result-kicker">Progreso del análisis</p>
                    <AnalyzeProgress phase={phase} firstRun={firstRun} context={runContext} />
                  </div>
                )}
                {!busy && summaryOpen && selected && (
                  <StatsCard
                    key={selected.id}
                    analysis={selected}
                    tasks={tasks}
                    compact
                    onClose={() => {
                      setSelected(null);
                      setSummaryOpen(false);
                    }}
                  />
                )}
              </aside>
            )}
          </div>
        )}

        {nav === "history" && (
          <main className="page">
            {place && (
              <p className="caption place-filter">
                Filtrado por coordenada{" "}
                <span className="num">
                  {place.lat}, {place.lon}
                </span>
                .{" "}
                <button type="button" className="close" onClick={() => setPlace(null)}>
                  Quitar filtro
                </button>
              </p>
            )}
            <AnalysisList
              items={history}
              selectedId={selected?.id}
              onSelect={openAnalysis}
              onRemove={onRemove}
              page
              empty={
                place
                  ? "Ningún análisis cubre ese punto. Quita el filtro de ubicación o inicia un nuevo análisis."
                  : undefined
              }
            />
          </main>
        )}

        {nav === "docs" && (
          <main className="page page-docs">
            <DocsScreen />
          </main>
        )}
      </div>
    </div>
  );
}
