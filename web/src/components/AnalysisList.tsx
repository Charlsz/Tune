import type { Analysis } from "../types";

interface Props {
  items: Analysis[];
  selectedId?: string;
  onSelect: (a: Analysis) => void;
}

const TASK_ICON: Record<string, string> = { flood: "💧", burn_scar: "🔥" };

export function AnalysisList({ items, selectedId, onSelect }: Props) {
  if (items.length === 0) return <p className="muted small">Sin análisis todavía.</p>;
  return (
    <section>
      <h3>Historial</h3>
      <ul className="history">
        {items.map((a) => (
          <li key={a.id}>
            <button
              className={a.id === selectedId ? "selected" : ""}
              onClick={() => onSelect(a)}
              title={a.input_filename}
            >
              <span>{TASK_ICON[a.task] ?? "•"}</span>
              <span className="name">{a.input_filename}</span>
              <span className="pct">{(a.affected_ratio * 100).toFixed(0)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
