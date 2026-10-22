import { HomeScreen } from "../components/home/HomeScreen";
import { useWorkspace } from "../router/workspace";

export function HomePage() {
  const { tasks, busy, firstRun, place, setPlace, onAnalyze, onExample, onCatalogAnalyze } =
    useWorkspace();

  return (
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
  );
}
