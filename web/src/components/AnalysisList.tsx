import { fmt, TASK_META } from "../lib/insights";
import type { Analysis } from "../types";

interface Props {
  items: Analysis[];
  selectedId?: string;
  onSelect: (a: Analysis) => void;
}

export function AnalysisList({ items, selectedId, onSelect }: Props) {
  return (
    <section className="section">
      <h2>
        Historial <span className="muted num">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="caption">Aún no hay análisis. Prueba con las escenas de `make examples`.</p>
      ) : (
        <ul className="list">
          {items.map((a) => (
            <li key={a.id}>
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// La máscara se usa como mask-image: recolorea el PNG sin procesarlo en JS.
function Thumb({ analysis: a }: { analysis: Analysis }) {
  const mask = `url(${a.artifacts.mask_png})`;
  return (
    <span className="thumb">
      {a.artifacts.preview_png && <img src={a.artifacts.preview_png} alt="" loading="lazy" />}
      <i style={{ maskImage: mask, WebkitMaskImage: mask }} />
    </span>
  );
}
