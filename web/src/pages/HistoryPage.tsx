import { AnalysisList } from "../components/history/AnalysisList";
import { useWorkspace } from "../router/workspace";

export function HistoryPage() {
  const { history, selected, place, setPlace, openAnalysis, onRemove } = useWorkspace();

  return (
    <main className="page page-canvas">
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
  );
}
