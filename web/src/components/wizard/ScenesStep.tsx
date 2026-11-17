import { ArrowLeft, ArrowRight, Check, ImageOff } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import { formatDate } from "../../domain/lab";
import { btnPrimary, btnText, emptyBox } from "../ui/classes";
import FadeIn from "../ui/FadeIn";
import { cn } from "../ui/cn";

export default function ScenesStep() {
  const { state, catalog, dispatch } = useMapApp();
  const emptyBoth = !catalog[0].length && !catalog[1].length;

  return (
    <FadeIn>
      <button
        type="button"
        className={btnText}
        onClick={() => dispatch({ type: "step", step: "dates" })}
      >
        <ArrowLeft size={14} /> Fechas
      </button>
      <p className="mb-4 mt-2 text-[12px] leading-relaxed text-fg-muted">
        Elige una escena Antes y una Después con poca nubosidad. Tune usará esas
        dos imágenes para el análisis.
      </p>
      {emptyBoth && (
        <div className={`${emptyBox} mb-4 flex items-start gap-3`}>
          <ImageOff size={18} className="mt-0.5 shrink-0 text-fg-soft" />
          <div>
            <p className="m-0 font-medium text-fg">Sin imágenes en esas fechas</p>
            <p className="mb-0 mt-1 text-[11px] leading-snug">
              Prueba fechas cercanas (±1–2 días) o un AOI distinto. Sentinel-2
              pasa cada ~5 días.
            </p>
          </div>
        </div>
      )}
      {catalog.map((scenes, i) => (
        <section className="my-4 mb-6" key={i}>
          <h2 className="mb-2 text-[13px] font-semibold">
            {i === 0 ? "Antes" : "Después"}{" "}
            <span className="mt-1.5 block text-[11px] font-normal text-fg-soft">
              {formatDate(state.dates[i])}
            </span>
          </h2>
          {!scenes.length ? (
            !emptyBoth && <p className={emptyBox}>Sin imágenes en esta fecha.</p>
          ) : (
            scenes.map((scene, j) => {
              const chosen = state.selected[i]?.id === scene.id;
              return (
                <button
                  type="button"
                  className={cn(
                    "my-1 flex w-full cursor-pointer items-center justify-start gap-2.5 rounded-none border bg-paper p-2 text-left transition-colors hover:bg-accent-soft",
                    chosen ? "border-[#6c92ef]" : "border-line",
                  )}
                  aria-pressed={chosen}
                  key={scene.id}
                  onClick={() =>
                    dispatch({
                      type: "scene",
                      index: i as 0 | 1,
                      scene,
                    })
                  }
                >
                  <img
                    src={scene.image}
                    alt={`Vista previa ${j + 1}`}
                    className="size-12 rounded-sm object-cover"
                  />
                  <div className="min-w-0">
                    <strong className="text-[11px] font-medium">
                      Imagen {j + 1}
                    </strong>
                    {scene.cloud_cover != null && (
                      <span className="mt-0.5 block text-[10px] text-fg-soft">
                        Nubes {Math.round(scene.cloud_cover)}%
                      </span>
                    )}
                  </div>
                  <span className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-full border border-[#c7cedd]">
                    {chosen && <Check size={12} />}
                  </span>
                </button>
              );
            })
          )}
        </section>
      ))}
      <button
        type="button"
        className={btnPrimary}
        disabled={!state.selected[0] || !state.selected[1]}
        onClick={() => dispatch({ type: "step", step: "ready" })}
      >
        Comparar
        <ArrowRight size={16} />
      </button>
    </FadeIn>
  );
}
