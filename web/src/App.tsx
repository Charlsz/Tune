import { useCallback, useEffect, useState } from "react";
import { type AnalyzePhase, api } from "./api";
import { AnalysisList } from "./components/AnalysisList";
import { CoordinateSearch } from "./components/CoordinateSearch";
import { Footer } from "./components/Footer";
import { RiskCard } from "./components/RiskCard";
import { SceneStage } from "./components/SceneStage";
import { Skeleton } from "./components/Skeleton";
import { sceneCenter, StatsCard } from "./components/StatsCard";
import { Timeline } from "./components/Timeline";
import { UploadPanel } from "./components/UploadPanel";
import type { Analysis, Place, TaskId, TaskInfo } from "./types";

export function App() {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [history, setHistory] = useState<Analysis[] | null>(null);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<AnalyzePhase | null>(null);
  const [runTask, setRunTask] = useState<TaskId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<Place | null>(null);

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
      .then((t) => {
        setTasks(t);
        setOnline(true);
      })
      .catch((e: Error) => {
        setOnline(false);
        setError(e.message);
      });
    refresh();
  }, [refresh]);

  async function run(task: TaskId, work: (onPhase: (p: AnalyzePhase) => void) => Promise<Analysis>) {
    setBusy(true);
    setError(null);
    setPhase(null);
    setRunTask(task);
    try {
      const a = await work(setPhase);
      setSelected(a);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }

  function onAnalyze(file: File, task: TaskId) {
    return run(task, (onPhase) => api.analyze(file, task, onPhase));
  }

  function onExample(id: string, task: TaskId) {
    return run(task, (onPhase) => api.analyzeExample(id, onPhase));
  }

  const firstRun = runTask != null && !(history ?? []).some((a) => a.task === runTask);
  const point = place ?? (selected ? sceneCenter(selected) : null);

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

  return (
    <div className="app">
      <header className="top">
        <span className="brand">Tune</span>
        <span className="muted">Análisis satelital con Prithvi-EO 2.0</span>
        {online === null ? (
          <Skeleton style={{ marginLeft: "auto", width: 80, height: 11, borderRadius: 3 }} />
        ) : (
          <span className={`status${online ? " ok" : ""}`}>
            {online ? "API en línea" : "API sin conexión"}
          </span>
        )}
        <a href={`${location.protocol}//${location.hostname}:8000/docs`} target="_blank" rel="noreferrer">
          Documentación
        </a>
      </header>

      <div className="body">
        <aside className="side">
          <section className="region">
            <h2>Analizar</h2>
            <UploadPanel
              tasks={tasks}
              busy={busy}
              phase={phase}
              firstRun={firstRun}
              onSubmit={onAnalyze}
              onExample={onExample}
            />
          </section>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {selected && (
            <section className="region">
              <h2>Resultado</h2>
              <StatsCard key={selected.id} analysis={selected} tasks={tasks} onClose={() => setSelected(null)} />
              {point && <RiskCard task={selected.task} place={point} acquiredAt={selected.acquired_at} />}
            </section>
          )}
          <section className="region">
            <h2>Encontrar</h2>
            <CoordinateSearch place={place} onSearch={setPlace} onClear={() => setPlace(null)} />
            <AnalysisList
              items={history}
              selectedId={selected?.id}
              onSelect={setSelected}
              onRemove={onRemove}
              empty={place ? "Ningún análisis cubre ese punto." : undefined}
            />
          </section>
        </aside>
        <div className="view">
          <SceneStage analysis={selected} tasks={tasks} busy={busy} loading={online === null} />
          {(place || (selected && !busy)) && (
            <Timeline analysis={selected} place={place} onSelect={setSelected} />
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
