import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases y resuelve conflictos Tailwind (bg/text/border/hover). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
