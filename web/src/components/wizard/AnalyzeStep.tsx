import { ArrowRight } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import { formatDate } from "../../domain/lab";
import { btnPrimary, btnText } from "../ui/classes";

export default function AnalyzeStep() {
  const { state, analyze, dispatch } = useMapApp();
  const running = state.step === "running";

  return (
    <>
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
        <div
          className="my-5 flex items-center gap-2 rounded-sm bg-running px-5 py-5 text-xs"
          role="status"
        >
          <span className="inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-[#819aca]" />
          Analizando…
        </div>
      ) : (
        <>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => void analyze()}
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
    </>
  );
}
