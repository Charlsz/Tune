import { SlidersHorizontal } from "lucide-react";
import type { State } from "../../domain/lab";
import { btnOutline, btnOutlineSelected, sectionGap } from "../ui/classes";
import { cn } from "../ui/cn";

type ViewPatch = Partial<
  Pick<State, "mode" | "slider" | "mask" | "opacity" | "split">
>;

/** Controles de vista del análisis activo (viven en Resultados). */
export default function VisualizationControls({
  state: s,
  onView,
}: {
  state: State;
  onView: (patch: ViewPatch) => void;
}) {
  const result = s.result;
  if (!result) return null;

  return (
    <div>
      <div
        className={cn(
          "flex w-full rounded-md border border-line bg-accent-soft p-1",
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

      <div className="pb-5 pt-1 max-[760px]:pb-4">
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
              ? "Capa de cambio"
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

      <div className="mb-1 py-4 max-[760px]:py-3">
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
    </div>
  );
}
