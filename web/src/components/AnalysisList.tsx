import { fmt, TASK_META } from "../lib/insights";
import type { Analysis } from "../types";

interface Props {
  items: Analysis[];
  selectedId?: string;
  onSelect: (a: Analysis) => void;
}

export function AnalysisList({ items, selectedId, onSelect }: Props) {
  return (
    <section className="block">
      <div className="section-title">
        <span>Historial</span>
        <span className="muted num">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="caption">Aún no hay análisis. Prueba con las escenas de `make examples`.</p>
      ) : (
        <ul className="list">
          {items.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                aria-current={a.id === selectedId ? "true" : undefined}
                style={{ "--accent": TASK_META[a.task].accent } as React.CSSProperties}
                onClick={() => onSelect(a)}
                title={a.input_filename}
              >
                <i className="dot" />
                <span className="list-main">
                  <span className="ellipsis">{a.input_filename}</span>
                  <span className="muted">
                    {TASK_META[a.task].name} · {fmt.ago(a.created_at)}
                  </span>
                </span>
                <span className="num">{fmt.pct(a.affected_ratio, 0)}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
