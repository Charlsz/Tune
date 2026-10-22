import { useEffect } from "react";
import { AnalyzeProgress } from "../components/analysis/AnalyzeProgress";
import { SceneStage } from "../components/analysis/SceneStage";
import { StatsCard } from "../components/analysis/StatsCard";
import { Timeline } from "../components/analysis/Timeline";
import { fmt } from "../lib/insights";
import { useWorkspace } from "../router/workspace";

export function AnalysisPage() {
  const {
    tasks,
    selected,
    busy,
    phase,
    runContext,
    place,
    summaryOpen,
    setSummaryOpen,
    firstRun,
    openAnalysis,
    closeSelected,
    goHome,
  } = useWorkspace();

  useEffect(() => {
    if (!selected) return;
    if (!window.matchMedia("(max-width: 720px)").matches) return;
    setSummaryOpen(false);
  }, [selected?.id, setSummaryOpen]);

  const summaryLabel = selected
    ? selected.change?.new_area_km2 != null
      ? `Resumen · ${fmt.km2(selected.change.new_area_km2)} km²`
      : "Mostrar resumen"
    : "Mostrar resumen";

  return (
    <main className="page page-analysis">
      <div className="analysis-layout">
        <div className="view">
          <SceneStage analysis={selected} tasks={tasks} busy={busy} onGoHome={goHome} />
          {(place || (selected && !busy)) && (
            <Timeline analysis={selected} place={place} onSelect={openAnalysis} />
          )}
        </div>
        {(busy || (selected && !busy)) && (
          <aside className={`summary-dock${summaryOpen || busy ? "" : " collapsed"}`}>
            {!busy && (
              <button
                type="button"
                className="summary-toggle"
                aria-expanded={summaryOpen}
                onClick={() => setSummaryOpen((open) => !open)}
              >
                {summaryOpen ? "Ocultar resumen" : summaryLabel}
              </button>
            )}
            {busy && (
              <div className="summary-busy">
                <p className="result-kicker">Progreso del análisis</p>
                <AnalyzeProgress phase={phase} firstRun={firstRun} context={runContext} />
              </div>
            )}
            {!busy && summaryOpen && selected && (
              <StatsCard
                key={selected.id}
                analysis={selected}
                tasks={tasks}
                compact
                onClose={closeSelected}
              />
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
