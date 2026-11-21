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
              const fill =
                scene.aoi_cover == null ? null : Math.round(scene.aoi_cover * 100);
              const fills = scenes
                .map((s) => (s.aoi_cover == null ? null : Math.round(s.aoi_cover * 100)))
                .filter((n): n is number => n != null);
              const best = fills.length ? Math.max(...fills) : null;
              const coversMost =
                fill != null && best != null && fill === best && fills.some((n) => n !== best);
              const cloud =
                scene.cloud_cover != null ? Math.round(scene.cloud_cover) : null;
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
                  <img
                    src={scene.image}
                    alt=""
                    className="size-12 shrink-0 rounded-sm object-cover"
                  />
                  <div className="min-w-0">
                    <strong className="text-[11px] font-medium">
                      {formatDate(scene.datetime)}
                    </strong>
                    <span className="mt-0.5 block text-[10px] tabular-nums text-fg-soft">
                      {cloud != null ? `Nubes ${cloud}%` : "Nubes —"}
                      {fill != null ? (
                        <>
                          <span aria-hidden> · </span>
                          <span className={coversMost ? "font-medium text-fg" : undefined}>
                            Recorte {fill}%
                          </span>
                        </>
                      ) : null}
                    </span>
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
