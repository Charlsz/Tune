import { ArrowRight, MapPin } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import { formatWeekRange, weekWindowsValid } from "../../domain/dateWindow";
import { formatDate } from "../../domain/lab";
import { btnPrimary } from "../ui/classes";
import FadeIn from "../ui/FadeIn";
import { CatalogSkeleton } from "../ui/Skeleton";
import { cn } from "../ui/cn";

export default function DatesStep() {
  const { state, loading, setLoading, dispatch, bumpTokens, findScenes } =
    useMapApp();
  const missing = !state.dates[0] || !state.dates[1];
  const orderOk = weekWindowsValid(state.dates[0], state.dates[1]);
  const invalid = missing || !orderOk;

  if (loading) {
    return (
      <FadeIn>
        <CatalogSkeleton />
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <div className="mb-4 flex items-center gap-2 text-xs">
        <MapPin size={15} className="shrink-0" />
        <span className="truncate">{state.label}</span>
        <button
          type="button"
          className="ml-auto cursor-pointer rounded-none border-0 bg-transparent p-1 text-[11px] text-[#3965cc]"
          onClick={() => dispatch({ type: "step", step: "area" })}
        >
          Cambiar
        </button>
      </div>
      <p className="mb-4 mt-0 text-[12px] leading-relaxed text-fg-muted">
        Elige el <strong className="font-medium text-fg">inicio</strong> de cada
        semana (7 días). Tune listará las escenas Sentinel-2 disponibles en ese
        rango; no hace falta acertar el día exacto del satélite.
      </p>
      {state.dates.map((d, i) => (
        <label
          className="mb-4 flex flex-col gap-2 text-[13px] text-fg-muted"
          key={i}
        >
          <span>
            {i === 0 ? "Semana Antes (línea base)" : "Semana Después (pico)"}
          </span>
          <input
            aria-label={
              i === 0 ? "Inicio semana Antes" : "Inicio semana Después"
            }
            type="date"
            className="min-w-0 rounded-sm border border-line bg-paper px-3 py-3 text-fg transition-colors focus:border-ink"
            value={d}
            onChange={(e) => {
              bumpTokens();
              setLoading(false);
              dispatch({
                type: "date",
                index: i as 0 | 1,
                value: e.target.value,
              });
            }}
          />
          {d ? (
            <span className="text-[11px] tabular-nums text-fg-soft">
              Ventana: {formatWeekRange(d, formatDate)}
            </span>
          ) : null}
        </label>
      ))}
      {!missing && !orderOk && (
        <p role="alert" className="mb-3 animate-fade-up text-[13px] text-danger">
          La semana Después debe empezar después de que termine la de Antes (sin
          solaparse).
        </p>
      )}
      <button
        type="button"
        className={cn(btnPrimary)}
        disabled={invalid}
        onClick={() => void findScenes()}
      >
        Consultar semana
        <ArrowRight size={17} />
      </button>
    </FadeIn>
  );
}
