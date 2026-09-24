import { affectedKm2, crsLabel, fmt, osmUrl, TASK_META } from "../lib/insights";
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
  const map = osmUrl(a);

  return (
    <section className="section result">
      <div className="result-head">
        <h2>{meta.name}</h2>
        <button type="button" className="close" aria-label="Cerrar resultado" onClick={onClose}>
          Cerrar
        </button>
      </div>

      <div className="figure num">
        {fmt.pct(a.affected_ratio)}
        <span>%</span>
      </div>
      <p className="caption">de los píxeles válidos son «{positive}»</p>

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
          {fmt.int(a.affected_pixels)} <span className="muted">de {fmt.int(a.valid_pixels)}</span>
        </Row>
        <Row k="Tamaño">
          {a.width} × {a.height} px
        </Row>
        <Row k="CRS">{crsLabel(a.crs)}</Row>
        {map && (
          <Row k="Ubicación">
            <a href={map} target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>
          </Row>
        )}
        <Row k="Modelo">
          <a className="ellipsis" href={`https://huggingface.co/${a.model_id}`} target="_blank" rel="noreferrer" title={a.model_id}>
            {a.model_id.split("/")[1]}
          </a>
        </Row>
        <Row k="Dataset">{meta.dataset}</Row>
        <Row k="Latencia">{fmt.secs(a.latency_s)}</Row>
        <Row k="Fecha">{fmt.ago(a.created_at)}</Row>
      </dl>

      <p className="downloads">
        <span className="muted">Descargar</span>
        {a.artifacts.mask_tif && <a href={a.artifacts.mask_tif}>GeoTIFF</a>}
        <a href={a.artifacts.mask_png}>PNG</a>
        {a.artifacts.preview_png && <a href={a.artifacts.preview_png}>RGB</a>}
        <a href={`/api/analyses/${a.id}`} target="_blank" rel="noreferrer">
          JSON
        </a>
      </p>
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
