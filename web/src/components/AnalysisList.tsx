import { fmt, TASK_META } from "../lib/insights";
import type { Analysis } from "../types";
import { Skeleton } from "./Skeleton";

interface Props {
  items: Analysis[] | null;
  selectedId?: string;
  onSelect: (a: Analysis) => void;
  onRemove: (a: Analysis) => void;
  empty?: string;
}

export function AnalysisList({ items, selectedId, onSelect, onRemove, empty }: Props) {
  return (
    <section className="section">
      <h3>
        Historial {items !== null && <span className="muted num">{items.length}</span>}
      </h3>
      {items === null ? (
        <ul className="list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} style={{ padding: "8px", display: "flex", alignItems: "center", gap: 12 }}>
              <Skeleton style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <Skeleton style={{ height: 13, width: "70%" }} />
                <Skeleton style={{ height: 11, width: "50%" }} />
              </div>
              <Skeleton style={{ width: 28, height: 13 }} />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="caption">{empty ?? "Aún no hay análisis. Prueba con las escenas de `make examples`."}</p>
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
                  </span>
                </span>
                <span className="num">{fmt.pct(a.affected_ratio, 0)}%</span>
              </button>
              <button type="button" className="close" onClick={() => onRemove(a)}>
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
