import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useMapApp } from "../../app/MapAppProvider";
import { paths } from "../../app/paths";
import { formatAoiCaption } from "../../domain/aoi";
import { formatDate } from "../../domain/lab";
import { btnPrimary, btnText } from "../ui/classes";
import FadeIn from "../ui/FadeIn";

/** Resumen corto en Mapa cuando hay análisis activo (opción A). */
export default function AnalyzeDone() {
  const { state, dispatch } = useMapApp();
  const navigate = useNavigate();
  const result = state.result;
  if (!result) return null;

  const caption = formatAoiCaption(result.label ?? state.label, result.aoi);

  return (
    <FadeIn>
      <p className="mb-1 mt-0 text-[11px] font-medium uppercase tracking-[0.06em] text-fg-soft">
        Listo
      </p>
      <p className="mb-3 mt-0 text-[15px] font-medium leading-snug text-ink">
        {caption}
      </p>
      <div className="mb-5 border-y border-line py-3 text-xs">
        <p className="m-0 py-1">
          Antes — {formatDate(result.before.datetime)}
        </p>
        <p className="m-0 py-1">
          Después — {formatDate(result.after.datetime)}
        </p>
        <p className="m-0 py-1 text-fg-muted">
          {result.areaKm2.toLocaleString("es", { maximumFractionDigits: 2 })}{" "}
          km² agua nueva
        </p>
      </div>
      <p className="mb-4 mt-0 text-[12px] leading-relaxed text-fg-muted">
        Modos, máscara y deslizador están en Resultados. El mapa ya muestra
        este análisis.
      </p>
      <button
        type="button"
        className={btnPrimary}
        onClick={() => navigate(paths.results)}
      >
        Ver Resultados
        <ArrowRight size={16} />
      </button>
      <button
        type="button"
        className={btnText}
        onClick={() => dispatch({ type: "step", step: "area" })}
      >
        Nuevo análisis
      </button>
    </FadeIn>
  );
}
