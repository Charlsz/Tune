import { ArrowRight, MapPin, Scan } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import {
  aoiHeadline,
  aoiLongSideKm,
  formatAoiKm2,
  squareKm2,
} from "../../domain/aoi";
import { aoiFitsCatalogLimits } from "../../data/apiBridge";
import { btnOutline, btnOutlineSelected, btnPrimary } from "../ui/classes";
import FadeIn from "../ui/FadeIn";

export default function AreaStep() {
  const { state, drawing, setDrawing, dispatch, maxSideKm } = useMapApp();
  const headline = aoiHeadline(state.label, state.aoi);
  const km2 = formatAoiKm2(state.aoi);
  const sideKm = aoiLongSideKm(state.aoi);
  const tooBig = !aoiFitsCatalogLimits(state.aoi, maxSideKm);
  const sideLabel = sideKm.toLocaleString("es", {
    maximumFractionDigits: sideKm >= 100 ? 0 : 1,
    minimumFractionDigits: sideKm >= 100 ? 0 : 1,
  });
  const maxSquare = squareKm2(maxSideKm).toLocaleString("es", {
    maximumFractionDigits: 0,
  });

  return (
    <FadeIn>
      <div className="mb-4 flex items-start gap-3 text-fg-muted">
        <MapPin size={18} className="mt-0.5 shrink-0" />
        <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
          <strong className="min-w-0 truncate text-sm font-medium text-fg">
            {headline}
          </strong>
          <span className="shrink-0 text-right tabular-nums text-[11px] leading-tight text-fg-muted">
            <span className="block">{km2}</span>
            <span className="block text-fg-soft">
              lado {sideLabel} / {maxSideKm} km
            </span>
          </span>
        </div>
      </div>
      <p className="mb-5 mt-0 text-[12px] leading-relaxed text-fg-muted">
        Busca un lugar arriba, pega coordenadas o dibuja el rectángulo. El
        catálogo admite hasta {maxSideKm} km en el lado más largo: un cuadrado
        de ese lado son {maxSquare} km². Arriba ves la superficie de este
        recorte y su lado frente a ese máximo.
      </p>
      {tooBig ? (
        <p role="alert" className="mb-3 text-[13px] leading-snug text-danger">
          Este recorte mide {sideLabel} km de lado ({km2}). El máximo es{" "}
          {maxSideKm} km de lado. Reduce el rectángulo antes de elegir fechas.
        </p>
      ) : null}
      <button
        type="button"
        className={drawing ? btnOutlineSelected : btnOutline}
        onClick={() => setDrawing(!drawing)}
      >
        <Scan size={17} />
        {drawing ? "Cancelar dibujo" : "Dibujar en el mapa"}
      </button>
      <button
        type="button"
        className={btnPrimary}
        disabled={tooBig}
        onClick={() => {
          setDrawing(false);
          dispatch({ type: "step", step: "dates" });
        }}
      >
        Continuar
        <ArrowRight size={17} />
      </button>
    </FadeIn>
  );
}
