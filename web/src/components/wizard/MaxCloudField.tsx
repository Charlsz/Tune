import { useMapApp } from "../../app/MapAppProvider";

/** Tope de nubosidad del recorte, en porcentaje. El catálogo y el análisis usan el mismo valor. */
export default function MaxCloudField() {
  const { maxCloud, setMaxCloud } = useMapApp();

  return (
    <label className="mb-4 flex flex-col gap-2 text-[13px] text-fg-muted">
      <span>Nubes máx.</span>
      <span className="flex min-w-0 items-center rounded-sm border border-line bg-paper transition-colors focus-within:border-ink">
        <input
          aria-label="Nubes máx., porcentaje"
          type="number"
          min={0}
          max={90}
          step={1}
          inputMode="numeric"
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-fg tabular-nums outline-none"
          value={maxCloud}
          onChange={(e) => setMaxCloud(Number(e.target.value))}
        />
        <span className="shrink-0 pr-3 tabular-nums text-fg-muted" aria-hidden>
          %
        </span>
      </span>
      <span className="text-[11px] leading-snug text-fg-soft">
        Porcentaje de nubes en el recorte, no el promedio de la escena.
      </span>
    </label>
  );
}
