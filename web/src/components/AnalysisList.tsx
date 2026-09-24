import { useState } from "react";
import { fmt, TASK_META } from "../lib/insights";
import type { Analysis, TaskId } from "../types";

interface Props {
  items: Analysis[];
  selectedId?: string;
  onSelect: (a: Analysis) => void;
}

type Filter = "all" | TaskId;

export function AnalysisList({ items, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? items : items.filter((a) => a.task === filter);
  const km2 = items.reduce((s, a) => s + (a.affected_area_km2 ?? 0), 0);

  return (
    <section className="panel history">
      <div className="readout-top">
        <span className="eyebrow">Registro</span>
        <div className="tabs">
          {(["all", "flood", "burn_scar"] as Filter[]).map((f) => (
            <button key={f} type="button" className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "Todo" : TASK_META[f].code}
            </button>
          ))}
        </div>
      </div>

      {items.length > 0 && (
        <div className="totals">
          <div>
            <span className="v num">{items.length}</span>
            <span className="k">análisis</span>
          </div>
          <div>
            <span className="v num">{fmt.km2(km2)}</span>
            <span className="k">km² detectados</span>
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="hint">Sin análisis todavía. Prueba con `make examples`.</p>
      ) : (
        <ul>
          {shown.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className={a.id === selectedId ? "on" : ""}
                style={{ "--accent": TASK_META[a.task].accent } as React.CSSProperties}
                onClick={() => onSelect(a)}
                title={a.input_filename}
              >
                <span className="h-code">{TASK_META[a.task].code}</span>
                <span className="h-main">
                  <span className="h-name">{a.input_filename}</span>
                  <span className="h-meta">
                    {fmt.ago(a.created_at)} · {fmt.secs(a.latency_s)}
                  </span>
                </span>
                <span className="h-pct num">{fmt.pct(a.affected_ratio, 0)}%</span>
                <span className="h-bar">
                  <i style={{ width: `${Math.min(a.affected_ratio, 1) * 100}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
