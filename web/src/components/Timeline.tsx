import { useEffect, useState } from "react";
import { api } from "../api";
import { fmt, TASK_META } from "../lib/insights";
import type { Analysis, Place, TaskId } from "../types";
import { Skeleton } from "./Skeleton";

type Filter = "all" | TaskId;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Ambas" },
  { id: "flood", label: "Inundación" },
  { id: "burn_scar", label: "Incendio" },
];

const SKEL_HEIGHTS = [48, 72, 36, 60];

export function Timeline({
  analysis,
  place,
  onSelect,
}: {
  analysis: Analysis | null;
  place: Place | null;
  onSelect: (a: Analysis) => void;
}) {
  const [items, setItems] = useState<Analysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!place && !analysis?.bounds) return;
    setItems(null);
    setError(null);
    const query = place
      ? { lat: place.lat, lon: place.lon }
      : { analysisId: analysis!.id };
    api
      .timeline(query)
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, [place, analysis]);

  const shown = (items ?? []).filter((a) => filter === "all" || a.task === filter);

  return (
    <section className="timeline" aria-label="Línea de tiempo del territorio">
      <div className="timeline-head">
        <h2>Territorio</h2>
        <div className="filters" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {!place && analysis && !analysis.bounds && (
        <p className="caption">Esta escena no tiene coordenadas, así que no se puede agrupar.</p>
      )}
      {error && <p className="caption">{error}</p>}

      {(place || analysis?.bounds) && items === null && !error && (
        <ol className="marks" aria-busy="true" aria-label="Cargando historial de territorio">
          {SKEL_HEIGHTS.map((h, i) => (
            <li
              key={i}
              style={{
                width: 72,
                height: 96,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 6,
                padding: "6px 0",
              }}
            >
              <Skeleton style={{ width: 8, height: `${h}%`, borderRadius: 2, flexShrink: 0 }} />
              <Skeleton style={{ width: 44, height: 11 }} />
            </li>
          ))}
        </ol>
      )}

      {items && shown.length === 0 && (
        <p className="caption">
          Ningún análisis
          {filter !== "all" && ` de ${TASK_META[filter].name.toLowerCase()}`} en este territorio.
        </p>
      )}
      {items && shown.length === 1 && <p className="caption">Solo hay un análisis de este territorio.</p>}
      {shown.length > 1 && (
        <ol className="marks">
          {shown.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                aria-current={a.id === analysis?.id ? "true" : undefined}
                title={`${a.input_filename} · ${
                  a.change?.new_area_km2 != null
                    ? `${fmt.km2(a.change.new_area_km2)} km² nuevos`
                    : `${fmt.pct(a.affected_ratio)} %`
                }`}
                onClick={() => onSelect(a)}
              >
                <i
                  className={a.task}
                  style={{
                    height: `${Math.max(
                      8,
                      a.change?.new_area_km2 != null && a.affected_area_km2
                        ? (a.change.new_area_km2 / Math.max(a.affected_area_km2, 1e-9)) * 100
                        : a.affected_ratio * 100
                    )}%`,
                  }}
                />
                <span className="num">{fmt.day((a.acquired_at ?? a.created_at).slice(0, 10))}</span>
                {!a.acquired_at && <span className="muted">Fecha de análisis</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
