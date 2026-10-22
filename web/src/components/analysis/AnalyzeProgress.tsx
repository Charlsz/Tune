import { useEffect, useRef, useState } from "react";
import { type AnalyzePhase } from "../../api";
import { formatRemain, remainingSeconds } from "../../lib/eta";
import { fmt } from "../../lib/insights";

type StepId = "prepare" | "upload" | "fetch" | "infer";

function stepsFor(context: string | null | undefined): { id: StepId; label: string }[] {
  if (context === "upload") {
    return [
      { id: "prepare", label: "Preparar archivo" },
      { id: "upload", label: "Subir GeoTIFF" },
      { id: "infer", label: "Validar y analizar" },
    ];
  }
  if (context === "catalog") {
    return [
      { id: "prepare", label: "Preparar petición" },
      { id: "fetch", label: "Descargar bandas Sentinel-2" },
      { id: "infer", label: "Ejecutar modelo" },
    ];
  }
  return [
    { id: "prepare", label: "Comprobar escena" },
    { id: "fetch", label: "Obtener imagen" },
    { id: "infer", label: "Ejecutar modelo" },
  ];
}

function activeStep(phase: AnalyzePhase | null): StepId {
  if (!phase) return "infer";
  if (phase.phase === "prepare" || phase.phase === "check") return "prepare";
  if (phase.phase === "upload") return "upload";
  if (phase.phase === "fetch") return "fetch";
  return "infer";
}

function stepStatus(
  id: StepId,
  active: StepId,
  order: StepId[],
): "done" | "active" | "pending" {
  const ai = order.indexOf(active);
  const ii = order.indexOf(id);
  if (ii < 0) return "pending";
  if (ii < ai) return "done";
  if (ii === ai) return "active";
  return "pending";
}

/** Progreso detallado del análisis (vista Análisis). */
export function AnalyzeProgress({
  phase,
  firstRun,
  context,
}: {
  phase: AnalyzePhase | null;
  firstRun: boolean;
  context?: string | null;
}) {
  const [t0] = useState(() => Date.now());
  const [phaseStarted, setPhaseStarted] = useState(() => Date.now());
  const [phaseKey, setPhaseKey] = useState<string>("");
  const [now, setNow] = useState(t0);
  const budget = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const key = phase?.phase ?? "idle";
    if (key !== phaseKey) {
      setPhaseKey(key);
      setPhaseStarted(Date.now());
      if (key === "infer") budget.current = 0;
    }
  }, [phase, phaseKey]);

  const elapsedS = (now - t0) / 1000;
  const phaseElapsedS = (now - phaseStarted) / 1000;
  const uploading = phase?.phase === "upload";
  const checking = phase?.phase === "check" || phase?.phase === "prepare";
  const fetching = phase?.phase === "fetch";
  const inferring =
    phase?.phase === "infer" || (!phase && !uploading && !checking && !fetching);

  let pct = 0;
  if (uploading && phase.total > 0) pct = Math.min(1, phase.loaded / phase.total);
  else if (fetching && phase.total > 0) pct = Math.min(1, phase.loaded / phase.total);

  const etaPhase =
    uploading || fetching
      ? { phase: phase.phase as "upload" | "fetch", loaded: phase.loaded, total: phase.total }
      : {
          phase: (checking ? "check" : inferring ? "infer" : null) as "check" | "infer" | null,
        };

  const remain = remainingSeconds(etaPhase, elapsedS, phaseElapsedS, firstRun, budget);

  const title = uploading
    ? "Subiendo archivo al servidor"
    : phase?.phase === "prepare"
      ? phase.detail ?? "Preparando análisis"
      : checking
        ? phase?.phase === "check" && phase.stale === false
          ? "Escena al día · preparando análisis"
          : context === "catalog"
            ? "Preparando descarga del catálogo"
            : "Buscando actualización de la escena"
        : fetching
          ? phase.refreshed === false
            ? "Escena lista (sin cambios)"
            : context === "catalog"
              ? "Descargando bandas Sentinel-2"
              : "Descargando escena oficial"
          : phase?.phase === "infer" && phase.detail
            ? phase.detail
            : firstRun
              ? "Cargando pesos del modelo y analizando"
              : "Analizando la escena con el modelo";

  const determinate = uploading || (fetching && pct < 0.999 && phase.total > 1);
  const right = determinate
    ? `${Math.round(pct * 100)}% · ${fmt.secs(elapsedS)} · quedan ${formatRemain(remain)}`
    : `${fmt.secs(elapsedS)} · quedan ${formatRemain(remain)}`;

  const steps = stepsFor(context);
  const order = steps.map((s) => s.id);
  const active = activeStep(phase);

  return (
    <div className="progress progress-panel" aria-live="polite">
      {context && <p className="caption progress-context">{contextLabel(context)}</p>}

      <ol className="progress-steps">
        {steps.map((s) => {
          const st = stepStatus(s.id, active, order);
          return (
            <li key={s.id} className={`progress-step ${st}`}>
              <span className="progress-step-dot" aria-hidden="true" />
              <span>{s.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="progress-row">
        <span>{title}</span>
        <span className="num muted">{right}</span>
      </div>
      <div className={`track ${determinate ? "" : "indeterminate"}`}>
        <i style={determinate ? { width: `${pct * 100}%` } : undefined} />
      </div>

      {uploading && (
        <p className="caption">
          Enviando {fmt.bytes(phase.loaded)} de {fmt.bytes(phase.total)}. Cuando termine la subida,
          el servidor validará el GeoTIFF y ejecutará el modelo.
        </p>
      )}
      {fetching && phase.total > 1 && (
        <p className="caption">
          {fmt.bytes(phase.loaded)} de {fmt.bytes(phase.total)} · transcurridos {fmt.secs(elapsedS)}
        </p>
      )}
      {fetching && context === "catalog" && phase.total <= 1 && (
        <p className="caption">
          Descargando el recorte de 6 bandas alrededor del punto. Luego corre la detección. Esto
          puede tardar varios minutos según el tamaño del recorte y la red.
        </p>
      )}
      {checking && context !== "catalog" && phase?.phase !== "prepare" && (
        <p className="caption">
          Comprueba si hay una versión nueva de la escena. Solo vuelve a bajar si cambió.
        </p>
      )}
      {inferring && (
        <p className="caption">
          {firstRun
            ? "Primera vez: puede descargar unos 1,2 GB de pesos del modelo. Si falla, reintenta o usa una escena de ejemplo."
            : "El modelo recorre la imagen en ventanas de 512×512. El tiempo restante se ajusta según el ritmo real."}{" "}
          Faltan ~{formatRemain(remain)}.
        </p>
      )}
    </div>
  );
}

function contextLabel(context: string): string {
  if (context === "catalog") return "Origen: catálogo Sentinel-2";
  if (context === "example") return "Origen: escena de ejemplo";
  if (context === "upload") return "Origen: archivo propio";
  return context;
}
