import { SlidersHorizontal } from "lucide-react";
import type { State } from "../../domain/lab";
import MapLegend from "../map/MapLegend";
import { btnOutline, btnOutlineSelected } from "../ui/classes";
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
      <p className="mb-2 mt-0 text-[11px] font-medium text-fg-soft">
        Vista en el mapa
      </p>
      <div
        className={cn(
          "mb-4 flex w-full rounded-md border border-line bg-accent-soft p-1",
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

      <MapLegend
        className="mb-4"
        mode={s.mode}
        mask={s.mask}
        slider={s.slider}
        hasFusion={Boolean(result.overlays?.fusion)}
        variant="panel"
      />

      <div className="pb-4 pt-1">
        <label className="flex items-center gap-3 text-sm max-xl:text-[15px] max-lg:text-xs max-sm:text-sm">
          <span
            className={cn(
              "size-6 shrink-0 rounded-none",
              s.mode === "agree"
                ? "bg-[linear-gradient(135deg,#16a34a_50%,#dc2626_50%)]"
                : s.mode === "change"
                  ? "bg-data-flood"
                  : "bg-data-water",
            )}
          />
          <span>
            {s.mode === "change" && !s.slider
              ? "Capa de cambio"
              : s.mode === "agree"
                ? "Capa de acuerdo"
                : "Máscara de agua"}
          </span>
          <input
            type="checkbox"
            className="ml-auto size-4 accent-ink"
            checked={s.mask}
            onChange={(e) => onView({ mask: e.target.checked })}
          />
        </label>
      </div>

      <div className="mb-3 py-2">
        <label className="flex flex-wrap items-center gap-2 text-[13px]">
          Opacidad
          <span className="ml-auto">{Math.round(s.opacity * 100)}%</span>
          <input
            aria-label="Opacidad"
            type="range"
            min="0"
            max="100"
            className="mt-2 mb-0 h-1.5 w-full accent-ink"
            value={s.opacity * 100}
            onChange={(e) => onView({ opacity: +e.target.value / 100 })}
          />
        </label>
      </div>

      <button
        type="button"
        className={cn(
          s.slider ? btnOutlineSelected : btnOutline,
          "mt-0",
        )}
        aria-pressed={s.slider}
        onClick={() => onView({ slider: !s.slider })}
      >
        <SlidersHorizontal size={17} />
        {s.slider ? "Cerrar deslizador" : "Deslizador"}
      </button>
      {s.slider ? (
        <p className="mb-0 mt-2 text-[11px] leading-snug text-fg-soft">
          Compara agua detectada en cada fecha (azul). El rojo/azul de inundación
          vs permanente está en el modo Cambio.
        </p>
      ) : null}
    </div>
  );
}
