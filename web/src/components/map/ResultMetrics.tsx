import type { ResultMetrics as Metrics } from "../../domain/lab";

function km(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toLocaleString("es", { maximumFractionDigits: 2 })} km²`;
}

function observationLabel(status: Metrics["observation"]) {
  if (status === "ok") return "GFM disponible";
  if (status === "empty") return "Sin GFM en zona/fecha";
  if (status === "error") return "GFM no consultable";
  if (status === "skipped") return "GFM desactivado";
  return null;
}

export default function ResultMetrics({ metrics }: { metrics?: Metrics }) {
  if (!metrics) return null;
  const pop =
    metrics.population == null
      ? null
      : Math.round(metrics.population).toLocaleString("es");
  const gfmNote = observationLabel(metrics.observation);
  const iou =
    metrics.fusionIou == null
      ? null
      : metrics.fusionIou.toLocaleString("es", { maximumFractionDigits: 2 });
  return (
    <div className="result-metrics">
      <dl>
        <div>
          <dt>Detectada</dt>
          <dd>{km(metrics.detectedKm2)}</dd>
        </div>
        <div>
          <dt>Nueva</dt>
          <dd>{km(metrics.newKm2)}</dd>
        </div>
        <div>
          <dt>Permanente</dt>
          <dd>{km(metrics.persistentKm2)}</dd>
        </div>
        <div>
          <dt>Retirada</dt>
          <dd>{km(metrics.recededKm2)}</dd>
        </div>
        {pop != null && (
          <div>
            <dt>Población</dt>
            <dd>{pop}</dd>
          </div>
        )}
        <div>
          <dt>Acuerdo GFM</dt>
          <dd>{iou != null ? `IoU ${iou}` : "—"}</dd>
        </div>
      </dl>
      {gfmNote && <p className="gfm-note">{gfmNote}</p>}
      {metrics.cover.length > 0 && (
        <ul className="cover-list">
          {metrics.cover.map((c) => (
            <li key={c.label}>
              <span>{c.label}</span>
              <strong>
                {c.areaKm2 == null
                  ? "—"
                  : `${c.areaKm2.toLocaleString("es", { maximumFractionDigits: 1 })} km²`}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
