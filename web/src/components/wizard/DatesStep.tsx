import { ArrowRight, MapPin } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import { btnPrimary } from "../ui/classes";
import FadeIn from "../ui/FadeIn";
import { CatalogSkeleton } from "../ui/Skeleton";
import { cn } from "../ui/cn";

export default function DatesStep() {
  const { state, loading, setLoading, dispatch, bumpTokens, findScenes } =
    useMapApp();
  const invalid =
    !state.dates[0] || !state.dates[1] || state.dates[0] >= state.dates[1];

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
        Elige una fecha <strong className="font-medium text-fg">Antes</strong> y
        otra <strong className="font-medium text-fg">Después</strong> del evento
        (p. ej. pico de inundación) para comparar agua nueva.
      </p>
      {state.dates.map((d, i) => (
        <label
          className="mb-4 flex flex-col gap-2 text-[13px] text-fg-muted"
          key={i}
        >
          <span>{i === 0 ? "Antes" : "Después"}</span>
          <input
            aria-label={i === 0 ? "Fecha Antes" : "Fecha Después"}
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
        </label>
      ))}
      {state.dates[0] >= state.dates[1] && (
        <p role="alert" className="mb-3 animate-fade-up text-[13px] text-danger">
          Después debe ser posterior a Antes.
        </p>
      )}
      <button
        type="button"
        className={cn(btnPrimary)}
        disabled={invalid}
        onClick={() => void findScenes()}
      >
        Consultar
        <ArrowRight size={17} />
      </button>
    </FadeIn>
  );
}
