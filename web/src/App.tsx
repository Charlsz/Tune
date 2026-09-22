import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { AnalysisList } from "./components/AnalysisList";
import { MapView } from "./components/MapView";
import { StatsCard } from "./components/StatsCard";
import { UploadPanel } from "./components/UploadPanel";
import type { Analysis, TaskId, TaskInfo } from "./types";

export function App() {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.analyses().then(setHistory).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    api.tasks().then(setTasks).catch((e: Error) => setError(e.message));
    refresh();
  }, [refresh]);

  async function onAnalyze(file: File, task: TaskId) {
    setBusy(true);
    setError(null);
    try {
      const a = await api.analyze(file, task);
      setSelected(a);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <header>
          <h1>Tune</h1>
          <p className="muted">Inundaciones e incendios con Prithvi‑EO 2.0 (IBM‑NASA)</p>
        </header>
        <UploadPanel tasks={tasks} busy={busy} onSubmit={onAnalyze} />
        {error && <p className="error">{error}</p>}
        {selected && <StatsCard analysis={selected} tasks={tasks} />}
        <AnalysisList items={history} selectedId={selected?.id} onSelect={setSelected} />
      </aside>
      <main className="map">
        <MapView analysis={selected} />
      </main>
    </div>
  );
}
