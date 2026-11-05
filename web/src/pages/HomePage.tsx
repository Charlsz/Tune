import { HomeScreen } from "../components/home/HomeScreen";
import { useWorkspace } from "../router/workspace";

export function HomePage() {
  const {
    tasks,
    busy,
    firstRun,
    place,
    history,
    setPlace,
    onAnalyze,
    onExample,
    onCatalogAnalyze,
  } = useWorkspace();

  return (
    <main className="page">
      <HomeScreen
        tasks={tasks}
        busy={busy}
        firstRun={firstRun}
        place={place}
        history={history}
        onPlace={setPlace}
        onSubmit={(file) => onAnalyze(file, "flood")}
        onExample={(id) => onExample(id, "flood")}
        onCatalogAnalyze={(itemId, at, sideKm, maxCloud) =>
          onCatalogAnalyze(itemId, "flood", at, sideKm, maxCloud)
        }
      />
    </main>
  );
}
