import { lazy, Suspense } from "react";
import { useWorkspace } from "../router/workspace";

const MapFirstHome = lazy(() =>
  import("../components/workspace/MapFirstHome").then((m) => ({ default: m.MapFirstHome })),
);

export function HomePage() {
  const { busy, history, selected, pair, setPlace, onCatalogComparePair, openPair } =
    useWorkspace();

  return (
    <main className="page page-map-first">
      <Suspense fallback={<p className="caption" style={{ padding: 16 }}>Cargando mapa…</p>}>
        <MapFirstHome
          busy={busy}
          history={history}
          selected={selected}
          pair={pair}
          onPlace={setPlace}
          onComparePair={onCatalogComparePair}
          onOpenPair={openPair}
        />
      </Suspense>
    </main>
  );
}
