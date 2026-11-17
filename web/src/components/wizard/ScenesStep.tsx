import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import { formatDate } from "../../domain/lab";
import { btnPrimary, btnText, emptyBox } from "../ui/classes";
import { cn } from "../ui/cn";

export default function ScenesStep() {
  const { state, catalog, dispatch } = useMapApp();

  return (
    <>
      <button
        type="button"
        className={btnText}
        onClick={() => dispatch({ type: "step", step: "dates" })}
      >
        <ArrowLeft size={14} /> Fechas
      </button>
      {catalog.map((scenes, i) => (
        <section className="my-4 mb-6" key={i}>
          <h2 className="mb-2 text-[13px] font-semibold">
            {i === 0 ? "Antes" : "Después"}{" "}
            <span className="mt-1.5 block text-[11px] font-normal text-fg-soft">
              {formatDate(state.dates[i])}
            </span>
          </h2>
          {!scenes.length ? (
            <p className={emptyBox}>Sin imágenes.</p>
          ) : (
            scenes.map((scene, j) => {
              const chosen = state.selected[i]?.id === scene.id;
              return (
                <button
                  type="button"
                  className={cn(
                    "my-1 flex w-full cursor-pointer items-center justify-start gap-2.5 rounded-none border bg-paper p-2 text-left hover:bg-accent-soft",
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
                  <div>
                    <strong className="text-[11px] font-medium">
                      Imagen {j + 1}
                    </strong>
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
    </>
  );
}
