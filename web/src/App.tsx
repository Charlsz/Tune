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
      <TopBar online={online} count={history.length} />
      <div className="layout">
        <aside className="rail">
          <UploadPanel tasks={tasks} busy={busy} phase={phase} firstRun={firstRun} onSubmit={onAnalyze} />
          {error && (
            <div className="alert" role="alert">
              <span className="eyebrow">Error</span>
              <p>{error}</p>
            </div>
          )}
          {selected && <StatsCard analysis={selected} tasks={tasks} />}
          <AnalysisList items={history} selectedId={selected?.id} onSelect={setSelected} />
        </aside>
        <main className="map">
          <MapView analysis={selected} />
        </main>
      </div>
    </div>
  );
}

function TopBar({ online, count }: { online: boolean | null; count: number }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const status = online == null ? "Conectando" : online ? "Sistema en línea" : "API sin conexión";

  return (
    <header className="topbar">
      <div className="brand">
        <span className="wordmark">TUNE</span>
        <span className="tagline">Análisis satelital · Prithvi-EO 2.0</span>
      </div>
      <div className="telemetry">
        <span className={`status ${online ? "ok" : online === false ? "down" : ""}`}>
          <i />
          {status}
        </span>
        <span className="num">{count} análisis</span>
        <span className="num">{now.toISOString().slice(11, 19)} UTC</span>
        <a href={`${location.protocol}//${location.hostname}:8000/docs`} target="_blank" rel="noreferrer">
          API
        </a>
      </div>
    </header>
  );
}
