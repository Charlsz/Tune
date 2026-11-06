import { useEffect, useMemo, useState } from "react";
import { AnalyzeProgress } from "../components/analysis/AnalyzeProgress";
import { PairCompare } from "../components/analysis/PairCompare";
import { SceneStage } from "../components/analysis/SceneStage";
import { StatsCard } from "../components/analysis/StatsCard";
import { Timeline } from "../components/analysis/Timeline";
import { api } from "../api";
import { findBeforeMate } from "../lib/pair";
import { fmt } from "../lib/insights";
import { useWorkspace } from "../router/workspace";
import type { Analysis } from "../types";

export function AnalysisPage() {
  const {
    tasks,
    selected,
    pair,
    busy,
    phase,
    runContext,
    place,
    summaryOpen,
    setSummaryOpen,
    firstRun,
    openAnalysis,
    openPair,
    clearPair,
    closeSelected,
    goHome,
  } = useWorkspace();

  const [placeList, setPlaceList] = useState<Analysis[] | null>(null);

  useEffect(() => {
    if (!selected) return;
    if (!window.matchMedia("(max-width: 720px)").matches) return;
    setSummaryOpen(false);
  }, [selected?.id, setSummaryOpen]);

  useEffect(() => {
    if (!place && !selected?.bounds) {
      setPlaceList(null);
      return;
    }
    let cancelled = false;
    const q = place
      ? { lat: place.lat, lon: place.lon, task: "flood" as const, limit: 50 }
      : { analysisId: selected!.id, task: "flood" as const };
    api
      .timeline(q)
      .then((list) => {
        if (!cancelled) setPlaceList(list);
      })
      .catch(() => {
        if (!cancelled) setPlaceList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [place?.lat, place?.lon, selected?.id, busy]);

  const resolvedBefore = useMemo(() => {
    if (pair?.before) return pair.before;
    if (!selected || !placeList) return null;
    return findBeforeMate(selected, placeList);
  }, [pair, selected, placeList]);

  const [wantPair, setWantPair] = useState(true);

  useEffect(() => {
    // Nueva selección: preferimos el par si hay línea base (definición de inundación).
    setWantPair(true);
  }, [selected?.id, pair?.after.id]);

  const activePair =
    pair ??
    (wantPair && selected && resolvedBefore
      ? { before: resolvedBefore, after: selected }
      : null);

  const summaryLabel = selected
    ? selected.change?.new_area_km2 != null
      ? `Resumen · ${fmt.km2(selected.change.new_area_km2)} km²`
      : "Mostrar resumen"
    : "Mostrar resumen";

  return (
    <main className="page page-analysis">
      <div className="analysis-layout">
        <div className="view">
          {!busy && activePair ? (
            <PairCompare
              before={activePair.before}
              after={activePair.after}
              onSelectSingle={(a) => {
                clearPair();
                setWantPair(false);
                openAnalysis(a);
              }}
              onClosePair={() => {
                clearPair();
                setWantPair(false);
              }}
            />
          ) : (
            <SceneStage analysis={selected} tasks={tasks} busy={busy} onGoHome={goHome} />
          )}

          {!busy && selected && resolvedBefore && !activePair && (
            <div className="pair-offer">
              <p className="caption">
                Hay una fecha <strong>Antes</strong> en este lugar. Compárala con el Después para
                ver inundación (agua nueva), no solo el cauce.
              </p>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  if (resolvedBefore && selected) {
                    openPair(resolvedBefore, selected, place);
                    setWantPair(true);
                  }
                }}
              >
                Ver Antes | Después
              </button>
            </div>
          )}

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
