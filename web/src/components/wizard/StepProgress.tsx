import { Check } from "lucide-react";
import type { Step } from "../../domain/lab";
import { sectionGap } from "../ui/classes";
import { cn } from "../ui/cn";

const STAGES = ["Área", "Fechas", "Imágenes", "Comparación"];

function stageIndex(step: Step): number {
  if (step === "area") return 0;
  if (step === "dates") return 1;
  if (step === "scenes") return 2;
  return 3;
}

export default function StepProgress({ step }: { step: Step }) {
  if (step === "results") return null;
  const stage = stageIndex(step);

  return (
    <div className={`flex items-center ${sectionGap}`} aria-label="Progreso">
      {STAGES.map((name, i) => {
        const done = i <= stage;
        return (
          <span
            key={name}
            title={name}
            className={cn(
              "relative mr-10 flex size-[22px] items-center justify-center rounded-full border text-[9px] last:mr-0",
              "after:absolute after:top-2.5 after:left-7 after:h-px after:w-8 after:content-[''] last:after:hidden",
              done
                ? "border-ink bg-ink text-paper after:bg-ink"
                : "border-line bg-paper text-fg-soft after:bg-line",
            )}
          >
            {i < stage ? <Check size={12} /> : i + 1}
          </span>
        );
      })}
    </div>
  );
}
