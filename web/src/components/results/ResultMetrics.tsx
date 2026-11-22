import type { ResultMetrics as Metrics } from "../../domain/lab";
import { panelCallout } from "../ui/classes";

/** km² de agua detectada sin cobertura de referencia comparable. */
const GAP_KM2_WARN = 1;

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

function referenceLabel(metrics: Metrics): string | null {
  const src = metrics.referenceSource;
  if (!src) return null;
  if (src === "history_baseline") {
    const day = metrics.referenceDates[0]?.slice(0, 10);
    return day
      ? `Referencia: escena previa (${day})`
      : "Referencia: escena previa del par";
  }
  if (src === "history") {
    const n = metrics.referenceDates.length;
    return n > 0
      ? `Referencia: historial (${n} fechas)`
      : "Referencia: historial del territorio";
  }
  if (src === "jrc_gsw_v1_4") return "Referencia: agua permanente JRC";
  return `Referencia: ${src}`;
}

function unclassifiedGapKm2(metrics: Metrics): number | null {
  const detected = metrics.detectedKm2;
  if (detected == null) return null;
  const classified =
    (metrics.newKm2 ?? 0) + (metrics.persistentKm2 ?? 0);
  const gap = detected - classified;
  return gap > GAP_KM2_WARN ? gap : null;
}

export default function ResultMetrics({ metrics }: { metrics?: Metrics }) {
  if (!metrics) return null;
  const pop =
    metrics.population == null
      ? null
      : Math.round(metrics.population).toLocaleString("es");
  const gfmNote = observationLabel(metrics.observation);
  const refNote = referenceLabel(metrics);
  const gapKm2 = unclassifiedGapKm2(metrics);
  const iou =
    metrics.fusionIou == null
      ? null
      : metrics.fusionIou.toLocaleString("es", { maximumFractionDigits: 2 });

  return (
    <div>
      <p className="mb-2 mt-0 text-[11px] font-medium text-fg-soft">Métricas</p>
      <dl className="m-0 grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <div>
          <dt className="text-[11px] text-muted">Detectada</dt>
          <dd className="mt-0.5 text-sm font-medium">{km(metrics.detectedKm2)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted">Nueva</dt>
          <dd className="mt-0.5 text-sm font-medium">{km(metrics.newKm2)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted">Permanente</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {km(metrics.persistentKm2)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted">Retirada</dt>
          <dd className="mt-0.5 text-sm font-medium">{km(metrics.recededKm2)}</dd>
        </div>
        {pop != null && (
          <div>
            <dt className="text-[11px] text-muted">Población</dt>
            <dd className="mt-0.5 text-sm font-medium">{pop}</dd>
          </div>
        )}
        <div>
          <dt className="text-[11px] text-muted">Acuerdo GFM</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {iou != null ? `IoU ${iou}` : "—"}
          </dd>
        </div>
      </dl>
      {refNote && <p className="mt-2.5 text-xs text-muted">{refNote}</p>}
      {gapKm2 != null && (
        <p className={`${panelCallout} mt-3 text-xs leading-snug`}>
          Hay {gapKm2.toLocaleString("es", { maximumFractionDigits: 1 })} km² de
          agua detectada sin cobertura de referencia comparable: no cuentan como
          inundación en Cambio ni en el deslizador.
        </p>
      )}
      {gfmNote && <p className="mt-2.5 text-xs text-muted">{gfmNote}</p>}
      {metrics.cover.length > 0 && (
        <ul className="mt-3.5 list-none border-t border-line p-0">
          {metrics.cover.map((c) => (
            <li
              key={c.label}
              className="flex justify-between gap-3 border-b border-line py-2 text-xs"
            >
              <span>{c.label}</span>
              <strong className="whitespace-nowrap font-medium">
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
