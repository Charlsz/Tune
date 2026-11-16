import {
  CalendarDays,
  Droplets,
  SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import { formatDate, type State } from "../../domain/lab";
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
    <div className="visualization-controls">
      <div className="mode-bar" aria-label="Modo temporal">
        {(
          [
            ["before", "Antes"],
            ["after", "Después"],
            ["change", "Cambio"],
            ["agree", "Acuerdo"],
          ] as const
        ).map(([mode, label]) => {
          const agreeDisabled =
            mode === "agree" && !result.overlays?.fusion;
          return (
            <button
              key={mode}
              aria-pressed={s.mode === mode && !s.slider}
              disabled={agreeDisabled}
              title={
                agreeDisabled
                  ? "Sin capa GFM para esta zona/fecha"
                  : undefined
              }
              onClick={() => onView({ mode, slider: false })}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="water-legend">
        <label>
          <span
            className={`water-swatch${s.mode === "agree" ? " agree" : ""}`}
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
            checked={s.mask}
            onChange={(e) => onView({ mask: e.target.checked })}
          />
        </label>
      </div>
      <ResultMetrics metrics={result.metrics} />
      <div className="panel-dates">
        <CalendarDays size={21} />
        <div>
          {s.selected.map((scene, i) => (
            <p key={i}>
              <span>{i === 0 ? "Antes" : "Después"}</span>
              <strong>{scene && formatDate(scene.datetime)}</strong>
            </p>
          ))}
          <button className="text-button" onClick={onDates}>
            Editar fechas
          </button>
        </div>
      </div>
      <div className="layer-control">
        <label className="opacity">
          Opacidad<span>{Math.round(s.opacity * 100)}%</span>
          <input
            aria-label="Opacidad"
            type="range"
            min="0"
            max="100"
            value={s.opacity * 100}
            onChange={(e) => onView({ opacity: +e.target.value / 100 })}
          />
        </label>
      </div>
      <button
        className={`outline full ${s.slider ? "selected" : ""}`}
        aria-pressed={s.slider}
        onClick={() => onView({ slider: !s.slider })}
      >
        <SlidersHorizontal size={17} />
        {s.slider ? "Cerrar deslizador" : "Deslizador"}
      </button>
      <button className="primary full new-analysis" onClick={onDates}>
        <Droplets size={19} />
        Otra fecha
        <ArrowRight size={17} />
      </button>
    </div>
  );
}
