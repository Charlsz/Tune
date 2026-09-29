import { affectedKm2, crsLabel, fmt, TASK_META } from "../lib/insights";
import type { Analysis, Place, TaskInfo } from "../types";
import { MetadataCard } from "./MetadataCard";

interface Props {
  analysis: Analysis;
  tasks: TaskInfo[];
  onClose: () => void;
}

export function sceneCenter(a: Analysis): Place | null {
  if (!a.bounds) return null;
  const center = (a.metadata as { center?: Place }).center;
  if (center) return center;
  return {
    lat: (a.bounds.north + a.bounds.south) / 2,
    lon: (a.bounds.east + a.bounds.west) / 2,
  };
}

export function StatsCard({ analysis: a, tasks, onClose }: Props) {
  const meta = TASK_META[a.task];
  const positive = tasks.find((t) => t.id === a.task)?.classes[1] ?? meta.name;
  const area = affectedKm2(a);
  const point = sceneCenter(a);

  return (
    <div className="result">
      <div className="result-head">
        <h3>{meta.name}</h3>
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
        <Row k="Ubicación">
          {point ? (
            <span className="where">
              <span>
                {point.lat.toFixed(4)}, {point.lon.toFixed(4)}
              </span>
              <a
                className="map-btn"
                href={`https://www.google.com/maps?q=${point.lat},${point.lon}`}
                target="_blank"
                rel="noreferrer"
              >
                Google Maps
              </a>
            </span>
          ) : (
            <span className="muted">No se puede ubicar</span>
          )}
        </Row>
      </dl>

      <details className="detail">
        <summary>Detalle</summary>
        <dl className="rows">
          <Row k="Adquisición">{a.acquired_at ? fmt.day(a.acquired_at) : <span className="muted">Desconocida</span>}</Row>
          <Row k="Tamaño">
            {a.width} × {a.height} px
          </Row>
          <Row k="CRS">{crsLabel(a.crs)}</Row>
          <Row k="Modelo">
            <a className="ellipsis" href={`https://huggingface.co/${a.model_id}`} target="_blank" rel="noreferrer" title={a.model_id}>
              {a.model_id.split("/")[1]}
            </a>
          </Row>
          <Row k="Dataset">{meta.dataset}</Row>
          <Row k="Latencia">{fmt.secs(a.latency_s)}</Row>
          <Row k="Análisis">{fmt.ago(a.created_at)}</Row>
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
        <MetadataCard analysis={a} />
      </details>
    </div>
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
