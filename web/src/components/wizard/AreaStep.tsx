import { ArrowRight, MapPin, Scan } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import { btnOutline, btnOutlineSelected, btnPrimary } from "../ui/classes";

export default function AreaStep() {
  const { state, drawing, setDrawing, dispatch } = useMapApp();

  return (
    <>
      <div className="mb-6 flex items-center gap-3 pb-0 text-fg-muted max-[760px]:mb-4">
        <MapPin size={18} />
        <div>
          <strong className="text-sm font-medium text-fg">{state.label}</strong>
        </div>
      </div>
      <button
        type="button"
        className={drawing ? btnOutlineSelected : btnOutline}
        onClick={() => setDrawing(!drawing)}
      >
        <Scan size={17} />
        {drawing ? "Cancelar" : "Dibujar"}
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
    </>
  );
}
