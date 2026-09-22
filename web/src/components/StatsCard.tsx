import type { Analysis, TaskInfo } from "../types";

interface Props {
  analysis: Analysis;
  tasks: TaskInfo[];
}

export function StatsCard({ analysis: a, tasks }: Props) {
  const positive = tasks.find((t) => t.id === a.task)?.classes[1] ?? "afectado";
  return (
    <section className="card">
      <h2>{positive}</h2>
      <p className="big">{(a.affected_ratio * 100).toFixed(1)}%</p>
      <dl>
        <dt>Área</dt>
        <dd>{a.affected_area_km2 != null ? `${a.affected_area_km2.toFixed(2)} km²` : "n/d"}</dd>
        <dt>Píxeles</dt>
        <dd>
          {a.affected_pixels.toLocaleString()} / {a.valid_pixels.toLocaleString()}
        </dd>
        <dt>Imagen</dt>
        <dd>
          {a.width}×{a.height} · {a.crs ?? "sin CRS"}
        </dd>
        <dt>Modelo</dt>
        <dd className="mono">{a.model_id.split("/")[1]}</dd>
        <dt>Tiempo</dt>
        <dd>{a.latency_s.toFixed(1)} s</dd>
      </dl>
      <p className="links">
        {a.artifacts.mask_tif && <a href={a.artifacts.mask_tif}>máscara .tif</a>}
        <a href={a.artifacts.mask_png}>máscara .png</a>
      </p>
    </section>
  );
}
