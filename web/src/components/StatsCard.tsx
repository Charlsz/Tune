import { affectedKm2, crsLabel, fmt, TASK_META } from "../lib/insights";
import type { Analysis, TaskInfo } from "../types";

interface Props {
  analysis: Analysis;
  tasks: TaskInfo[];
  onClose: () => void;
}

export function StatsCard({ analysis: a, tasks, onClose }: Props) {
  const meta = TASK_META[a.task];
  const positive = tasks.find((t) => t.id === a.task)?.classes[1] ?? meta.name;
  const area = affectedKm2(a);

  return (
    <section className="card result" style={{ "--accent": meta.accent } as React.CSSProperties}>
      <div className="card-head">
        <span className="tag">
          <i className="dot" />
          {meta.name}
        </span>
        <span className="muted">{fmt.ago(a.created_at)}</span>
        <button type="button" className="close" aria-label="Cerrar resultado" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="figure">
        <span className="figure-num num">{fmt.pct(a.affected_ratio)}</span>
        <span className="figure-unit">%</span>
      </div>
      <p className="muted">de los píxeles válidos son «{positive}»</p>
      <div className="ratio" aria-hidden>
        <i style={{ width: `${Math.min(a.affected_ratio, 1) * 100}%` }} />
      </div>

      <dl className="rows">
        <Row k="Área afectada">
          {area.value == null ? (
            <span className="muted">Sin CRS</span>
          ) : (
            <>
              {area.estimated && "≈ "}
              {fmt.km2(area.value)} km²
            </>
          )}
        </Row>
        <Row k="Píxeles afectados">
          {fmt.int(a.affected_pixels)} <span className="muted">/ {fmt.int(a.valid_pixels)}</span>
        </Row>
        <Row k="Escena">
          <span className="ellipsis" title={a.input_filename}>
            {a.input_filename}
          </span>
        </Row>
        <Row k="Tamaño">
          {a.width} × {a.height} px
        </Row>
        <Row k="CRS">{crsLabel(a.crs)}</Row>
        <Row k="Modelo">
          <a className="ellipsis" href={`https://huggingface.co/${a.model_id}`} target="_blank" rel="noreferrer">
            {a.model_id.split("/")[1]}
          </a>
        </Row>
        <Row k="Dataset">{meta.dataset}</Row>
        <Row k="Latencia">{fmt.secs(a.latency_s)}</Row>
      </dl>

      <div className="chips">
        {a.artifacts.mask_tif && <a href={a.artifacts.mask_tif}>GeoTIFF</a>}
        <a href={a.artifacts.mask_png}>PNG</a>
        {a.artifacts.preview_png && <a href={a.artifacts.preview_png}>RGB</a>}
        <a href={`/api/analyses/${a.id}`} target="_blank" rel="noreferrer">
          JSON
        </a>
      </div>
    </section>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="row">
      <dt>{k}</dt>
      <dd className="num">{children}</dd>
    </div>
  );
}
