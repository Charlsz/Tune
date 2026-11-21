import { ArrowRight, MapPin, Scan } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import { formatAoiCaption } from "../../domain/aoi";
import { btnOutline, btnOutlineSelected, btnPrimary } from "../ui/classes";
import FadeIn from "../ui/FadeIn";

export default function AreaStep() {
  const { state, drawing, setDrawing, dispatch } = useMapApp();
  const coords = formatAoiCaption(undefined, state.aoi);

  return (
    <FadeIn>
      <div className="mb-4 flex items-start gap-3 text-fg-muted">
        <MapPin size={18} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <strong className="block text-sm font-medium text-fg">
            {state.label}
          </strong>
          <span className="mt-1 block text-[11px] tabular-nums text-fg-soft">
            {coords}
          </span>
        </div>
      </div>
      <p className="mb-5 mt-0 text-[12px] leading-relaxed text-fg-muted">
        Busca un lugar arriba, pega coordenadas, o activa Dibujar y arrastra el
        rectángulo exacto en el mapa (el AOI es ese trazo, no un cuadrado fijo).
        Mínimo ~0,2 km de lado; máximo ~150 km.
      </p>
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
