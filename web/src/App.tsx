import { useCallback, useEffect, useState } from "react";
import { type AnalyzePhase, api } from "./api";
import { AnalysisList } from "./components/AnalysisList";
import { MapView } from "./components/MapView";
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

  async function onAnalyze(file: File, task: TaskId) {
    setBusy(true);
    setError(null);
    setPhase(null);
    setRunTask(task);
    try {
      const a = await api.analyze(file, task, setPhase);
      setSelected(a);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }

  const firstRun = runTask != null && !history.some((a) => a.task === runTask);

  return (
    <div className="app">
      <MapView analysis={selected} />
      <aside className="sheet">
        <header className="sheet-head">
          <span className="brand">Tune</span>
          <span className={`status ${online ? "ok" : online === false ? "down" : ""}`}>
            {online == null ? "Conectando" : online ? "En línea" : "Sin conexión"}
          </span>
          <a className="link" href={`${location.protocol}//${location.hostname}:8000/docs`} target="_blank" rel="noreferrer">
            API
          </a>
        </header>

        <UploadPanel tasks={tasks} busy={busy} phase={phase} firstRun={firstRun} onSubmit={onAnalyze} />

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        {selected && <StatsCard key={selected.id} analysis={selected} tasks={tasks} onClose={() => setSelected(null)} />}

        <AnalysisList items={history} selectedId={selected?.id} onSelect={setSelected} />
      </aside>
    </div>
  );
}
