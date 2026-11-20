import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Droplets,
  History,
  Map,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useMapApp } from "../../app/MapAppProvider";
import { paths } from "../../app/paths";
import { formatAoiCaption } from "../../domain/aoi";
import { formatDate } from "../../domain/lab";
import {
  btnOutline,
  btnPrimary,
  btnText,
  emptyBox,
  panelCallout,
  panelLead,
  panelMeta,
  sectionGap,
} from "../ui/classes";
import FadeIn from "../ui/FadeIn";
import PanelHeader from "../ui/PanelHeader";
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
      <PanelHeader title="Resultados" icon={BarChart3} />
      {result ? (
        <>
          <p className={`${panelLead} mb-1`}>
            {formatAoiCaption(result.label ?? state.label, result.aoi)}
          </p>
          <p className={`${panelMeta} mb-5 flex flex-wrap items-center gap-x-2`}>
            <span>Análisis activo de esta sesión</span>
            <button
              type="button"
              className={cnLink}
              onClick={() => navigate(paths.history)}
            >
              Cambiar en Historial
            </button>
          </p>

          <div
            className={`mb-5 flex gap-4 border-y border-line py-4 max-[760px]:gap-3 max-[760px]:py-3`}
          >
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

          <div className={sectionGap}>
            <p className="m-0 text-[11px] text-fg-soft">Agua nueva (cambio)</p>
            <strong className="mt-1 block text-[22px] font-semibold tracking-[-0.4px] text-ink max-sm:text-[24px]">
              {result.areaKm2.toLocaleString("es", {
                maximumFractionDigits: 2,
              })}
              <span className="text-[13px] font-medium tracking-normal text-fg-soft">
                {" "}
                km²
              </span>
            </strong>
            <p className={`${panelCallout} mt-3`}>
              En Tune, inundación = agua nueva frente a la referencia, no agua
              total.
            </p>
          </div>

          <div className={sectionGap}>
            <VisualizationControls state={state} onView={patch} />
          </div>

          <div className={sectionGap}>
            <ResultMetrics metrics={result.metrics} />
          </div>

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
            className={`${btnOutline} mt-2`}
            onClick={goEditDates}
          >
            <Droplets size={17} />
            Otra fecha
            <ArrowRight size={16} className="ml-auto" />
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
