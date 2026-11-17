import { ArrowRight, CalendarDays, Droplets, History, Map } from "lucide-react";
import { useNavigate } from "react-router";
import { useMapApp } from "../../app/MapAppProvider";
import { paths } from "../../app/paths";
import { formatAoiCaption } from "../../domain/aoi";
import { formatDate } from "../../domain/lab";
import {
  btnPrimary,
  btnText,
  emptyBox,
  sectionGap,
} from "../ui/classes";
import FadeIn from "../ui/FadeIn";
import ResultMetrics from "./ResultMetrics";
import VisualizationControls from "./VisualizationControls";

export default function ResultsPanel() {
  const { state, patch, dispatch } = useMapApp();
  const navigate = useNavigate();
  const result = state.result;

  const goEditDates = () => {
    dispatch({ type: "step", step: "dates" });
    navigate(paths.map);
  };

  return (
    <FadeIn>
      <h1
        className={`m-0 text-[21px] font-semibold tracking-[-0.45px] ${sectionGap}`}
      >
        Resultados
      </h1>
      {result ? (
        <>
          <p className="mb-1 mt-0 text-[11px] text-fg-muted">
            {formatAoiCaption(result.label ?? state.label, result.aoi)}
          </p>
          <p className="mb-4 mt-0 flex flex-wrap items-center gap-x-2 text-[11px] text-fg-soft">
            <span>Análisis activo de esta sesión</span>
            <button
              type="button"
              className={cnLink}
              onClick={() => navigate(paths.history)}
            >
              Cambiar en Historial
            </button>
          </p>

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

          <div className="mb-5 flex gap-4 border-y border-line py-4 max-[760px]:gap-3 max-[760px]:py-3">
            <CalendarDays size={21} className="mt-1 shrink-0 text-fg-muted" />
            <div className="min-w-0">
              <p className="mb-2 flex flex-wrap gap-2 text-xs">
                <span className="min-w-[57px] text-fg-muted">Antes</span>
                <strong className="font-normal">
                  {formatDate(result.before.datetime)}
                </strong>
              </p>
              <p className="mb-2 flex flex-wrap gap-2 text-xs">
                <span className="min-w-[57px] text-fg-muted">Después</span>
                <strong className="font-normal">
                  {formatDate(result.after.datetime)}
                </strong>
              </p>
              <button
                type="button"
                className={`${btnText} pb-0 text-[10px]`}
                onClick={goEditDates}
              >
                Editar fechas
              </button>
            </div>
          </div>

          <VisualizationControls state={state} onView={patch} />

          <button
            type="button"
            className={btnPrimary}
            onClick={() => navigate(paths.map)}
          >
            Ver en el mapa
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className={`${btnPrimary} justify-center gap-2.5`}
            onClick={goEditDates}
          >
            <Droplets size={19} className="mr-auto" />
            Otra fecha
            <ArrowRight size={17} className="ml-auto" />
          </button>
        </>
      ) : (
        <div className={`${emptyBox} flex flex-col gap-3`}>
          <div className="flex items-start gap-3">
            <Map size={18} className="mt-0.5 shrink-0 text-fg-soft" />
            <div>
              <p className="m-0 font-medium text-fg">Aún no hay análisis</p>
              <p className="mb-0 mt-1 text-[11px] leading-snug">
                Completa el flujo en Mapa (área → fechas → escenas → Analizar).
                Si ya corriste alguno en esta sesión, reábrelo desde Historial.
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
          {state.history.length > 0 ? (
            <button
              type="button"
              className={btnText}
              onClick={() => navigate(paths.history)}
            >
              <History size={14} />
              Abrir Historial ({state.history.length})
            </button>
          ) : null}
        </div>
      )}
    </FadeIn>
  );
}

const cnLink =
  "cursor-pointer rounded-none border-0 bg-transparent p-0 text-[11px] text-ink underline-offset-2 hover:underline";
