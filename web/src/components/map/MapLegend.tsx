import type { Mode } from "../../domain/lab";
import { cn } from "../ui/cn";

type Swatch = { color: string; label: string };

function itemsFor(
  mode: Mode,
  opts: { mask: boolean; slider: boolean; hasFusion: boolean },
): { title: string; items: Swatch[] } | null {
  if (opts.slider) {
    return {
      title: "Deslizador",
      items: [
        {
          color: "var(--color-data-water)",
          label: "Antes: agua detectada",
        },
        {
          color: "var(--color-data-flood)",
          label: "Después: inundación (agua nueva)",
        },
        {
          color: "var(--color-data-persistent)",
          label: "Después: agua permanente",
        },
      ],
    };
  }
  if (mode === "before" || mode === "after") {
    if (!opts.mask) return null;
    return {
      title: mode === "before" ? "Antes" : "Después",
      items: [
        {
          color: "var(--color-data-water)",
          label: "Agua detectada en esa fecha",
        },
      ],
    };
  }
  if (mode === "change") {
    if (!opts.mask) return null;
    return {
      title: "Cambio",
      items: [
        { color: "var(--color-data-flood)", label: "Agua nueva (inundación)" },
        {
          color: "var(--color-data-persistent)",
          label: "Agua permanente (vieja)",
        },
        { color: "var(--color-data-receded)", label: "Agua retirada" },
      ],
    };
  }
  if (mode === "agree") {
    if (!opts.hasFusion || !opts.mask) return null;
    return {
      title: "Acuerdo GFM",
      items: [
        { color: "var(--color-data-agree)", label: "Acuerdo Tune ∩ GFM" },
        { color: "var(--color-data-flood)", label: "Solo Tune" },
        { color: "var(--color-data-water)", label: "Solo GFM" },
      ],
    };
  }
  return null;
}

/** Leyenda semántica según modo de vista (data hues only). */
export default function MapLegend({
  mode,
  mask,
  slider,
  hasFusion,
  variant = "map",
  className,
}: {
  mode: Mode;
  mask: boolean;
  slider: boolean;
  hasFusion: boolean;
  variant?: "map" | "panel";
  className?: string;
}) {
  const legend = itemsFor(mode, { mask, slider, hasFusion });
  if (!legend) return null;

  return (
    <div
      className={cn(
        variant === "map"
          ? "rounded-sm border border-line bg-paper px-3 py-2.5 shadow-[0_3px_12px_#15324815]"
          : "rounded-sm border border-line bg-accent-soft px-3 py-2.5",
        className,
      )}
      role="group"
      aria-label={`Leyenda: ${legend.title}`}
    >
      <p className="m-0 mb-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-fg-soft">
        {legend.title}
      </p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {legend.items.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2 text-[11px] leading-snug text-fg"
          >
            <span
              className="size-2.5 shrink-0 rounded-none"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
