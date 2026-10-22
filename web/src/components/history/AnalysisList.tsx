import { affectedKm2, fmt, TASK_META } from "../../lib/insights";
import type { Analysis } from "../../types";
import { Skeleton } from "../shared/Skeleton";

interface Props {
  items: Analysis[] | null;
  selectedId?: string;
  onSelect: (a: Analysis) => void;
  onRemove: (a: Analysis) => void;
  empty?: string;
  /** Vista de página completa con más contexto. */
  page?: boolean;
}

function primaryMetric(a: Analysis): string {
  if (a.change?.new_area_km2 != null) {
    return `${fmt.km2(a.change.new_area_km2)} km² nuevos`;
  }
  const area = affectedKm2(a);
  if (area.value != null) {
    return `${area.estimated ? "≈ " : ""}${fmt.km2(area.value)} km²`;
  }
  return `${fmt.pct(a.affected_ratio, 0)}%`;
}

export function AnalysisList({
  items,
  selectedId,
  onSelect,
  onRemove,
  empty,
  page = false,
}: Props) {
  return (
    <section className={`section history-section${page ? " history-page" : ""}`}>
      {page ? (
        <header className="page-head">
          <h1>Historial</h1>
          <p className="page-lead">
            Ejecuciones anteriores. Selecciona una para ver el mapa y el resumen; puedes quitar
            entradas del historial local.
          </p>
        </header>
      ) : (
        <h3>
          Historial {items !== null && <span className="muted num">{items.length}</span>}
        </h3>
      )}

      {items === null ? (
        <ul className="list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="history-skel">
              <Skeleton style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <Skeleton style={{ height: 13, width: "70%" }} />
                <Skeleton style={{ height: 11, width: "50%" }} />
              </div>
              <Skeleton style={{ width: 48, height: 13 }} />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-copy">
            <p className="welcome-title">Sin análisis</p>
            <p className="caption">
              {empty ?? "Aún no hay análisis. Inicia uno desde Inicio con una escena oficial o tu GeoTIFF."}
            </p>
          </div>
        </div>
      ) : (
        <ul className="list">
          {items.map((a) => (
            <li key={a.id} className="history-row">
              <button
                type="button"
                aria-current={a.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(a)}
                title={a.input_filename}
              >
                <Thumb analysis={a} />
                <span className="list-main">
                  <span className="ellipsis">{a.input_filename}</span>
                  <span className="muted">
                    {TASK_META[a.task].name} · {fmt.ago(a.created_at)}
                    {a.acquired_at ? ` · adquis. ${fmt.day(a.acquired_at)}` : ""}
                  </span>
                </span>
                <span className="num list-metric">{primaryMetric(a)}</span>
              </button>
              <button
                type="button"
                className="close"
                aria-label={`Quitar ${a.input_filename}`}
                onClick={() => onRemove(a)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Thumb({ analysis: a }: { analysis: Analysis }) {
  const mask = `url(${a.artifacts.mask_png})`;
  return (
    <span className="thumb">
      {a.artifacts.preview_png && <img src={a.artifacts.preview_png} alt="" loading="lazy" />}
      <i style={{ maskImage: mask, WebkitMaskImage: mask }} />
    </span>
  );
}
