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
    <div
      className={`flex w-full items-center ${sectionGap}`}
      aria-label="Progreso"
    >
      {STAGES.map((name, i) => {
        const done = i <= stage;
        const lineDone = i < stage;
        const isLast = i === STAGES.length - 1;
        return (
          <div
            key={name}
            className={cn("flex min-w-0 items-center", !isLast && "flex-1")}
          >
            <span
              title={name}
              className={cn(
                "relative z-[1] flex size-[22px] shrink-0 items-center justify-center rounded-full border text-[9px]",
                done
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-paper text-fg-soft",
              )}
            >
              {i < stage ? <Check size={12} /> : i + 1}
            </span>
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "mx-1.5 h-px min-w-0 flex-1",
                  lineDone ? "bg-ink" : "bg-line",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
