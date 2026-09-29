import { useCallback, useEffect, useState } from "react";
import { type AnalyzePhase, api } from "./api";
import { AnalysisList } from "./components/AnalysisList";
import { CoordinateSearch } from "./components/CoordinateSearch";
import { Footer } from "./components/Footer";
import { MetadataCard } from "./components/MetadataCard";
import { RiskCard } from "./components/RiskCard";
import { SceneStage } from "./components/SceneStage";
import { Skeleton } from "./components/Skeleton";
import { StatsCard } from "./components/StatsCard";
import { Timeline } from "./components/Timeline";
import { UploadPanel } from "./components/UploadPanel";
import type { Analysis, Place, TaskId, TaskInfo } from "./types";

function scenePoint(analysis: Analysis | null): Place | null {
  if (!analysis?.bounds) return null;
  const center = (analysis.metadata as { center?: Place }).center;
  if (center) return center;
  return {
    lat: (analysis.bounds.north + analysis.bounds.south) / 2,
    lon: (analysis.bounds.east + analysis.bounds.west) / 2,
  };
}

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
  const point = place ?? scenePoint(selected);

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
          <UploadPanel
            tasks={tasks}
            busy={busy}
            phase={phase}
            firstRun={firstRun}
            onSubmit={onAnalyze}
            onExample={onExample}
          />
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {selected && <StatsCard key={selected.id} analysis={selected} tasks={tasks} onClose={() => setSelected(null)} />}
          {selected && point && <RiskCard task={selected.task} place={point} />}
          {selected && <MetadataCard key={`meta-${selected.id}`} analysis={selected} />}
          <CoordinateSearch place={place} onSearch={setPlace} onClear={() => setPlace(null)} />
          <AnalysisList
            items={history}
            selectedId={selected?.id}
            onSelect={setSelected}
            empty={place ? "Ningún análisis cubre ese punto." : undefined}
          />
        </aside>
        <div className="view">
          <SceneStage analysis={selected} tasks={tasks} busy={busy} loading={online === null} />
          {(place || (selected && !busy)) && (
            <Timeline analysis={selected} place={place} onSelect={setSelected} />
          )}
        </div>
        <Footer />
      </div>
    </div>
  );
}
