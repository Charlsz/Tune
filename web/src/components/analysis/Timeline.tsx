import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { fmt, TASK_META } from "../../lib/insights";
import type { Analysis, Place, SeriesPoint, TaskId } from "../../types";
import { Skeleton } from "../shared/Skeleton";

type Filter = "all" | TaskId;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "flood", label: "Inundación" },
  { id: "burn_scar", label: "Incendio" },
];

const SKEL_HEIGHTS = [48, 72, 36, 60];

/**
 * Historial de corridas en el mismo lugar + serie de km² (API /timeline/series).
 */
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
  const [series, setSeries] = useState<SeriesPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!place && !analysis?.bounds) return;
    setItems(null);
    setSeries(null);
    setError(null);
    const base = place
      ? { lat: place.lat, lon: place.lon }
      : { analysisId: analysis!.id };
    const seriesQuery =
      filter === "all" ? base : { ...base, task: filter as TaskId };
    Promise.all([api.timeline(base), api.timelineSeries(seriesQuery)])
      .then(([list, pts]) => {
        setItems(list);
        setSeries(pts);
      })
      .catch((e: Error) => setError(e.message));
  }, [place, analysis, filter]);

  const shown = (items ?? []).filter((a) => filter === "all" || a.task === filter);
  const taskVariety = items != null && new Set(items.map((a) => a.task)).size > 1;
  const showFilters = (items?.length ?? 0) > 1 && taskVariety;

  const chart = useMemo(() => buildSparkline(series), [series]);

  return (
    <section className="timeline" aria-label="Historial del lugar">
      <div className="timeline-head">
        <div>
          <h2>Historial del lugar</h2>
          <p className="caption timeline-lead">
            Otras corridas que cubren las mismas coordenadas. No cambia la máscara de arriba: solo
            deja elegir un análisis anterior para comparar fechas.
          </p>
        </div>
        {showFilters && (
          <div className="filters" role="tablist" aria-label="Filtrar por tipo de análisis">
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
        )}
      </div>

      {!place && analysis && !analysis.bounds && (
        <p className="caption">Esta escena no tiene coordenadas, así que no se puede agrupar.</p>
      )}
      {error && <p className="caption">{error}</p>}

      {chart && chart.points.length > 1 && (
        <div className="timeline-series" aria-label="Serie de km²">
          <p className="caption">
            Tendencia de{" "}
            {chart.usesNew ? "posible inundación (agua nueva)" : "área afectada"} en el
            territorio
          </p>
          <svg
            className="series-chart"
            viewBox={`0 0 ${chart.w} ${chart.h}`}
            role="img"
            aria-label={chart.label}
          >
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={chart.points.map((p) => `${p.x},${p.y}`).join(" ")}
            />
            {chart.points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3" fill="currentColor" />
            ))}
          </svg>
          <div className="series-axis caption num">
            <span>{chart.firstDate}</span>
            <span>
              máx. {fmt.km2(chart.maxKm2)} km²
            </span>
            <span>{chart.lastDate}</span>
          </div>
        </div>
      )}

      {(place || analysis?.bounds) && items === null && !error && (
        <ol className="marks" aria-busy="true" aria-label="Cargando historial">
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
          {filter !== "all" && ` de ${TASK_META[filter].name.toLowerCase()}`} en este lugar.
        </p>
      )}

      {items && shown.length === 1 && (
        <div className="timeline-single">
          <p>
            Por ahora solo hay <strong>una corrida</strong> aquí (
            {TASK_META[shown[0].task].name.toLowerCase()},{" "}
            {fmt.day((shown[0].acquired_at ?? shown[0].created_at).slice(0, 10))}
            ). Cuando analices otra fecha del mismo sitio, aparecerán en fila para comparar.
          </p>
        </div>
      )}

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
                        : a.affected_ratio * 100,
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

function buildSparkline(series: SeriesPoint[] | null) {
  if (!series || series.length < 2) return null;
  const usesNew = series.some((p) => p.new_km2 != null);
  const values = series.map((p) => (usesNew ? p.new_km2 : p.affected_km2) ?? 0);
  const maxKm2 = Math.max(...values, 1e-6);
  const w = 280;
  const h = 56;
  const pad = 6;
  const points = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (w - pad * 2),
    y: h - pad - (v / maxKm2) * (h - pad * 2),
  }));
  return {
    w,
    h,
    points,
    maxKm2,
    usesNew,
    firstDate: series[0].date,
    lastDate: series[series.length - 1].date,
    label: `Serie de ${values.length} puntos, máximo ${maxKm2.toFixed(2)} km²`,
  };
}
