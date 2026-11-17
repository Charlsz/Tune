import { Layers } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import PanelHeader from "../ui/PanelHeader";
import AnalyzeDone from "./AnalyzeDone";
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
  results: "Listo",
} as const;

export default function WizardPanel() {
  const { state } = useMapApp();

  return (
    <>
      {state.step !== "results" && <StepProgress step={state.step} />}
      <PanelHeader title={TITLES[state.step]} icon={Layers} />
      {state.step === "area" && <AreaStep />}
      {state.step === "dates" && <DatesStep />}
      {state.step === "scenes" && <ScenesStep />}
      {(state.step === "ready" || state.step === "running") && <AnalyzeStep />}
      {state.step === "results" && state.result && <AnalyzeDone />}
    </>
  );
}
