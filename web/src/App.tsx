import { useCallback, useEffect, useState } from "react";
import { type AnalyzePhase, api } from "./api";
import { AnalysisList } from "./components/AnalysisList";
import { SceneStage } from "./components/SceneStage";
import { StatsCard } from "./components/StatsCard";
import { UploadPanel } from "./components/UploadPanel";
import type { Analysis, TaskId, TaskInfo } from "./types";

export function App() {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<AnalyzePhase | null>(null);
  const [runTask, setRunTask] = useState<TaskId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.analyses().then(setHistory).catch((e: Error) => setError(e.message));
  }, []);

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

  const firstRun = runTask != null && !history.some((a) => a.task === runTask);

  return (
    <div className="app">
      <header className="top">
        <span className="brand">Tune</span>
        <span className="muted">Análisis satelital con Prithvi-EO 2.0</span>
        <span className={`status ${online ? "ok" : ""}`}>
          {online == null ? "Conectando" : online ? "API en línea" : "API sin conexión"}
        </span>
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
          <AnalysisList items={history} selectedId={selected?.id} onSelect={setSelected} />
        </aside>
        <SceneStage analysis={selected} tasks={tasks} busy={busy} />
      </div>
    </div>
  );
}
