import {
  ArrowRight,
  CalendarDays,
  Droplets,
  SlidersHorizontal,
} from "lucide-react";
import { formatDate, type State } from "../../domain/lab";
import {
  btnOutline,
  btnOutlineSelected,
  btnPrimary,
  btnText,
  sectionGap,
} from "../ui/classes";
import { cn } from "../ui/cn";
import ResultMetrics from "./ResultMetrics";

type ViewPatch = Partial<Pick<State, "mode" | "slider" | "mask" | "opacity">>;

export default function VisualizationControls({
  state: s,
  onView,
  onDates,
}: {
  state: State;
  onView: (patch: ViewPatch) => void;
  onDates: () => void;
}) {
  const result = s.result;
  if (!result) return null;

  return (
    <div>
      <div
        className={cn(
          "flex w-full rounded-md border border-[#e5e7ec] bg-[#f3f4f6] p-1",
          sectionGap,
        )}
        aria-label="Modo temporal"
      >
        {(
          [
            ["before", "Antes"],
            ["after", "Después"],
            ["change", "Cambio"],
            ["agree", "Acuerdo"],
          ] as const
        ).map(([mode, label]) => {
          const agreeDisabled = mode === "agree" && !result.overlays?.fusion;
          const pressed = s.mode === mode && !s.slider;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={pressed}
              disabled={agreeDisabled}
              title={
                agreeDisabled ? "Sin capa GFM para esta zona/fecha" : undefined
              }
              className={cn(
                "flex-1 cursor-pointer rounded-sm border-0 px-1.5 py-2.5 text-sm",
                "max-xl:text-[15px] max-lg:text-xs max-sm:text-sm",
                "disabled:cursor-not-allowed disabled:opacity-35",
                pressed
                  ? "bg-ink text-paper"
                  : "bg-transparent text-fg-muted",
              )}
              onClick={() => onView({ mode, slider: false })}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="pb-6 pt-1 max-[760px]:pb-4">
        <label className="flex items-center gap-3 text-sm max-xl:text-[15px] max-lg:text-xs max-sm:text-sm">
          <span
            className={cn(
              "size-6 shrink-0 rounded-none",
              s.mode === "agree"
                ? "bg-[linear-gradient(135deg,#16a34a_50%,#dc2626_50%)]"
                : "bg-data-water",
            )}
          />
          <span>
            {s.mode === "change" && !s.slider
              ? `${result.areaKm2.toLocaleString("es", { maximumFractionDigits: 2 })} km²`
              : s.mode === "agree"
                ? "Acuerdo GFM"
                : "Máscara"}
          </span>
          <input
            type="checkbox"
            className="ml-auto size-4 accent-ink"
            checked={s.mask}
            onChange={(e) => onView({ mask: e.target.checked })}
          />
        </label>
      </div>

      <ResultMetrics metrics={result.metrics} />

      <div className="flex gap-4 border-y border-line py-5 max-[760px]:gap-3 max-[760px]:py-3">
        <CalendarDays size={21} className="mt-1 shrink-0 text-fg-muted" />
        <div className="min-w-0">
          {s.selected.map((scene, i) => (
            <p
              key={i}
              className="mb-2 flex flex-wrap gap-2 text-xs leading-normal max-xl:text-[13px] max-lg:text-[11px] max-sm:text-[13px]"
            >
              <span className="min-w-[57px] text-fg-muted">
                {i === 0 ? "Antes" : "Después"}
              </span>
              <strong className="font-normal">
                {scene && formatDate(scene.datetime)}
              </strong>
            </p>
          ))}
          <button
            type="button"
            className={cn(btnText, "pb-2 text-[10px]")}
            onClick={onDates}
          >
            Editar fechas
          </button>
        </div>
      </div>

      <div className="mb-1 py-6 max-[760px]:py-4">
        <label className="flex flex-wrap items-center gap-2 text-[13px]">
          Opacidad
          <span className="ml-auto">{Math.round(s.opacity * 100)}%</span>
          <input
            aria-label="Opacidad"
            type="range"
            min="0"
            max="100"
            className="mt-3 mb-1 h-1.5 w-full accent-ink"
            value={s.opacity * 100}
            onChange={(e) => onView({ opacity: +e.target.value / 100 })}
          />
        </label>
      </div>

      <button
        type="button"
        className={s.slider ? btnOutlineSelected : btnOutline}
        aria-pressed={s.slider}
        onClick={() => onView({ slider: !s.slider })}
      >
        <SlidersHorizontal size={17} />
        {s.slider ? "Cerrar deslizador" : "Deslizador"}
      </button>
      <button
        type="button"
        className={cn(btnPrimary, "justify-center gap-2.5")}
        onClick={onDates}
      >
        <Droplets size={19} className="mr-auto" />
        Otra fecha
        <ArrowRight size={17} className="ml-auto" />
      </button>
    </div>
  );
}
