import { useMapApp } from "../../app/MapAppProvider";
import { useAppPage } from "../../app/useAppPage";

/** Chip de estado sobre el mapa mientras consulta o analiza. */
export default function MapStatusBanner() {
  const { loading, state, analyzeProgress } = useMapApp();
  const page = useAppPage();

  if (page !== "map") return null;

  const analyzing = state.step === "running";
  if (!loading && !analyzing) return null;

  const scene =
    analyzeProgress?.scene === "after" ? "Después (2/2)" : "Antes (1/2)";
  const phase =
    analyzeProgress?.phase === "fetch"
      ? "descargando bandas"
      : analyzeProgress?.phase === "infer"
        ? "ejecutando modelo"
        : "preparando";

  return (
    <div
      className="absolute top-6 left-1/2 z-[720] flex max-w-[min(90%,22rem)] -translate-x-1/2 items-center gap-2.5 rounded-sm border border-line bg-paper px-3.5 py-2.5 text-[11px] text-fg shadow-[0_3px_12px_#15324815] animate-fade-up max-sm:top-[4.25rem]"
      role="status"
      aria-live="polite"
    >
      <span className="tune-spinner tune-spinner-sm shrink-0" aria-hidden />
      {loading ? (
        <span>
          <strong className="font-medium text-ink">Consultando catálogo</strong>
          <span className="text-fg-muted"> · Sentinel-2 / STAC</span>
        </span>
      ) : (
        <span>
          <strong className="font-medium text-ink">Analizando</strong>
          <span className="text-fg-muted">
            {" "}
            · {scene} · {phase}
          </span>
        </span>
      )}
    </div>
  );
}
