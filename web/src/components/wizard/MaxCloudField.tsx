import { useMapApp } from "../../app/MapAppProvider";

/** Tope de nubosidad del recorte. El catálogo y el análisis usan el mismo valor. */
export default function MaxCloudField() {
  const { maxCloud, setMaxCloud } = useMapApp();

  return (
    <label className="mb-4 flex flex-col gap-2 text-[13px] text-fg-muted">
      <span>Nubes máx.</span>
      <input
        aria-label="Nubes máx."
        type="number"
        min={0}
        max={90}
        step={1}
        inputMode="numeric"
        className="min-w-0 rounded-sm border border-line bg-paper px-3 py-3 text-fg tabular-nums transition-colors focus:border-ink"
        value={maxCloud}
        onChange={(e) => setMaxCloud(Number(e.target.value))}
      />
      <span className="text-[11px] leading-snug text-fg-soft">
        Tope de nubes en el recorte, no el promedio de la escena (~100 km).
      </span>
    </label>
  );
}
