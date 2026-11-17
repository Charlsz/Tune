import type { ReactNode } from "react";
import { cn } from "./cn";

/** Entrada sutil al cambiar de paso del wizard. */
export default function FadeIn({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  return (
    <div
      className={cn("animate-fade-up", className)}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
