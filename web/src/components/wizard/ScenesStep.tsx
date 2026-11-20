import { ArrowLeft, ArrowRight, Check, ImageOff } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import { formatWeekRange } from "../../domain/dateWindow";
import { formatDate } from "../../domain/lab";
import { btnPrimary, btnText, emptyBox } from "../ui/classes";
import FadeIn from "../ui/FadeIn";
import { cn } from "../ui/cn";

export default function ScenesStep() {
  const { state, catalog, dispatch, selectScene } = useMapApp();
  const emptyBoth = !catalog[0].length && !catalog[1].length;

  return (
    <FadeIn>
      <button
        type="button"
        className={btnText}
        onClick={() => dispatch({ type: "step", step: "dates" })}
      >
        <ArrowLeft size={14} /> Semanas
      </button>
      <p className="mb-4 mt-2 text-[12px] leading-relaxed text-fg-muted">
        Escenas de la semana en orden de fecha (inicio → fin). Al elegir una,
        el mapa pide un preview del AOI (puede tardar unos segundos la primera
        vez). Fuera del cuadrado no hay satélite; huecos de cobertura quedan
        transparentes.
      </p>
      {emptyBoth && (
        <div className={`${emptyBox} mb-4 flex items-start gap-3`}>
          <ImageOff size={18} className="mt-0.5 shrink-0 text-fg-soft" />
          <div>
            <p className="m-0 font-medium text-fg">
              Sin Sentinel-2 en estas semanas
            </p>
            <p className="mb-0 mt-1 text-[11px] leading-snug">
              Mueve el inicio de la semana o cambia el AOI. El satélite pasa cada
              ~5 días; nubes o huecos de catálogo dejan semanas vacías.
            </p>
          </div>
        </div>
      )}
      {catalog.map((scenes, i) => (
        <section className="my-4 mb-6" key={i}>
          <h2 className="mb-2 text-[13px] font-semibold">
            {i === 0 ? "Antes" : "Después"}{" "}
            <span className="mt-1.5 block text-[11px] font-normal text-fg-soft">
              {formatWeekRange(state.dates[i], formatDate)}
            </span>
          </h2>
          {!scenes.length ? (
            !emptyBoth && (
              <p className={emptyBox}>
                Sin imágenes en esta semana. Vuelve a Semanas y desplaza el
                inicio.
              </p>
            )
          ) : (
            scenes.map((scene) => {
              const selected = state.selected[i];
              const chosen = selected?.id === scene.id;
              const previewLoading = chosen && selected?.previewStatus === "loading";
              return (
                <button
                  type="button"
                  className={cn(
                    "my-1 flex w-full cursor-pointer items-center justify-start gap-2.5 rounded-none border bg-paper p-2 text-left transition-colors hover:bg-accent-soft",
                    chosen ? "border-line-strong bg-accent-soft" : "border-line",
                  )}
                  aria-pressed={chosen}
                  aria-busy={previewLoading || undefined}
                  key={scene.id}
                  onClick={() => selectScene(i as 0 | 1, scene)}
                >
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-sm">
                    <img
                      src={scene.image}
                      alt=""
                      className={cn(
                        "size-12 object-cover",
                        previewLoading && "opacity-45",
                      )}
                    />
                    {previewLoading && (
                      <span
                        className="absolute inset-0 flex items-center justify-center bg-paper/55"
                        aria-hidden
                      >
                        <span className="tune-spinner tune-spinner-sm" />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <strong className="text-[11px] font-medium">
                      {formatDate(scene.datetime)}
                    </strong>
                    {previewLoading ? (
                      <span className="mt-0.5 block text-[10px] text-fg-muted">
                        Cargando preview…
                      </span>
                    ) : (
                      scene.cloud_cover != null && (
                        <span className="mt-0.5 block text-[10px] text-fg-soft">
                          Nubes {Math.round(scene.cloud_cover)}%
                        </span>
                      )
                    )}
                  </div>
                  <span className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-full border border-line">
                    {chosen && !previewLoading && <Check size={12} />}
                    {previewLoading && (
                      <span className="tune-spinner tune-spinner-sm" aria-hidden />
                    )}
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
