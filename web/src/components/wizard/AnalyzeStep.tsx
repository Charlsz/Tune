import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useMapApp } from "../../app/MapAppProvider";
import { paths } from "../../app/paths";
import { formatDate } from "../../domain/lab";
import { btnPrimary, btnText } from "../ui/classes";
import FadeIn from "../ui/FadeIn";
import AnalyzeRunning from "./AnalyzeRunning";
import MaxCloudField from "./MaxCloudField";

export default function AnalyzeStep() {
  const { state, analyze, dispatch } = useMapApp();
  const navigate = useNavigate();
  const running = state.step === "running";

  return (
    <FadeIn>
      <div className="my-6 border-y border-line py-3 text-xs max-[760px]:my-4">
        {state.selected.map((scene, i) => (
          <div className="flex justify-between gap-3 py-2" key={i}>
            <span className="text-fg-soft">{i === 0 ? "Antes" : "Después"}</span>
            <strong className="font-medium">
              {scene && formatDate(scene.datetime)}
            </strong>
          </div>
        ))}
      </div>
      {running ? (
        <AnalyzeRunning />
      ) : (
        <>
          <p className="mb-4 mt-0 text-[12px] leading-relaxed text-fg-muted">
            Tune descargará las bandas Sentinel-2 y ejecutará Prithvi en ambas
            fechas para detectar agua nueva.
          </p>
          <MaxCloudField />
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              void analyze().then((ok) => {
                if (ok) navigate(paths.results);
              });
            }}
          >
            Analizar
            <ArrowRight size={17} />
          </button>
          <button
            type="button"
            className={btnText}
            onClick={() => dispatch({ type: "step", step: "scenes" })}
          >
            Cambiar imágenes
          </button>
        </>
      )}
    </FadeIn>
  );
}
