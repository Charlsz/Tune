import { Layers } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import VisualizationControls from "../results/VisualizationControls";
import { sectionGap } from "../ui/classes";
import AnalyzeStep from "./AnalyzeStep";
import AreaStep from "./AreaStep";
import DatesStep from "./DatesStep";
import ScenesStep from "./ScenesStep";
import StepProgress from "./StepProgress";

const TITLES = {
  area: "Área",
  dates: "Fechas",
  scenes: "Imágenes",
  ready: "Comparación",
  running: "Analizando",
  results: "Resultado",
} as const;

export default function WizardPanel() {
  const { state, patch, dispatch } = useMapApp();

  return (
    <>
      <StepProgress step={state.step} />
      <div className={`flex items-center gap-3 ${sectionGap}`}>
        <Layers size={25} className="shrink-0" />
        <h1 className="m-0 text-[21px] font-semibold leading-tight tracking-[-0.45px] max-xl:text-[23px] max-lg:text-[19px] max-sm:text-[22px]">
          {TITLES[state.step]}
        </h1>
      </div>
      {state.step === "area" && <AreaStep />}
      {state.step === "dates" && <DatesStep />}
      {state.step === "scenes" && <ScenesStep />}
      {(state.step === "ready" || state.step === "running") && <AnalyzeStep />}
      {state.step === "results" && state.result && (
        <VisualizationControls
          state={state}
          onView={patch}
          onDates={() => dispatch({ type: "step", step: "dates" })}
        />
      )}
    </>
  );
}
