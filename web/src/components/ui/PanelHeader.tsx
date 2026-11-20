import type { LucideIcon } from "lucide-react";
import { panelTitle, sectionGap } from "./classes";
import { cn } from "./cn";

/** Cabecera tipográfica compartida del cromo flotante. */
export default function PanelHeader({
  title,
  icon: Icon,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn(`flex items-center gap-3 ${sectionGap}`, className)}>
      {Icon ? <Icon size={25} className="shrink-0 text-ink" aria-hidden /> : null}
      <h1 className={panelTitle}>{title}</h1>
    </div>
  );
}
