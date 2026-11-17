import { ArrowRight, Map } from "lucide-react";
import { useNavigate } from "react-router";
import { useMapApp } from "../../app/MapAppProvider";
import { paths } from "../../app/paths";
import { formatAoiCaption } from "../../domain/aoi";
import { formatDate } from "../../domain/lab";
import { btnPrimary, emptyBox, sectionGap } from "../ui/classes";
import FadeIn from "../ui/FadeIn";
import ResultMetrics from "./ResultMetrics";

export default function ResultsPanel() {
  const { state } = useMapApp();
  const navigate = useNavigate();
  const result = state.result;

  return (
    <FadeIn>
      <h1
        className={`m-0 text-[21px] font-semibold tracking-[-0.45px] ${sectionGap}`}
      >
        Resultados
      </h1>
      {result ? (
        <>
          <p className="mb-3 mt-0 text-[11px] text-fg-muted">
            {formatAoiCaption(state.label, result.aoi)}
          </p>
          <div className="mb-6 border-y border-line py-3 text-xs max-[760px]:mb-4">
            <p className="m-0 py-1">
              Antes — {formatDate(result.before.datetime)}
            </p>
            <p className="m-0 py-1">
              Después — {formatDate(result.after.datetime)}
            </p>
          </div>
          <div className="pb-5">
            <p className="m-0 text-[11px] text-fg-soft">Agua nueva (cambio)</p>
            <strong className="mt-1 block text-[32px] font-medium tracking-[-1.1px]">
              {result.areaKm2.toLocaleString("es", {
                maximumFractionDigits: 2,
              })}
              <span className="text-[15px] tracking-normal text-fg-soft">
                {" "}
                km²
              </span>
            </strong>
          </div>
          <ResultMetrics metrics={result.metrics} />
          <button
            type="button"
            className={btnPrimary}
            onClick={() => navigate(paths.map)}
          >
            Ver en el mapa
            <ArrowRight size={16} />
          </button>
        </>
      ) : (
        <div className={`${emptyBox} flex flex-col gap-3`}>
          <div className="flex items-start gap-3">
            <Map size={18} className="mt-0.5 shrink-0 text-fg-soft" />
            <div>
              <p className="m-0 font-medium text-fg">Aún no hay análisis</p>
              <p className="mb-0 mt-1 text-[11px] leading-snug">
                Completa el flujo en Mapa: área → fechas → escenas → Analizar.
                Aquí verás el agua nueva y las métricas.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => navigate(paths.map)}
          >
            Ir a Mapa
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </FadeIn>
  );
}
