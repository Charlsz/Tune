import { ArrowRight, MapPin } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import { btnPrimary } from "../ui/classes";

export default function DatesStep() {
  const { state, loading, setLoading, dispatch, bumpTokens, findScenes } =
    useMapApp();
  const invalid =
    !state.dates[0] || !state.dates[1] || state.dates[0] >= state.dates[1];

  return (
    <>
      <div className="mb-6 flex items-center gap-2 text-xs max-[760px]:mb-4">
        <MapPin size={15} />
        {state.label}
        <button
          type="button"
          className="ml-auto cursor-pointer rounded-none border-0 bg-transparent p-1 text-[11px] text-[#3965cc]"
          onClick={() => dispatch({ type: "step", step: "area" })}
        >
          Cambiar
        </button>
      </div>
      {state.dates.map((d, i) => (
        <label
          className="mb-4 flex flex-col gap-2 text-[13px] text-fg-muted"
          key={i}
        >
          <span>{i === 0 ? "Antes" : "Después"}</span>
          <input
            aria-label={i === 0 ? "Fecha Antes" : "Fecha Después"}
            type="date"
            className="min-w-0 rounded-sm border border-line bg-paper px-3 py-3 text-fg"
            value={d}
            onChange={(e) => {
              bumpTokens();
              setLoading(false);
              dispatch({
                type: "date",
                index: i as 0 | 1,
                value: e.target.value,
              });
            }}
          />
        </label>
      ))}
      {state.dates[0] >= state.dates[1] && (
        <p role="alert" className="mb-2 text-[13px] text-danger">
          Después debe ser posterior a Antes.
        </p>
      )}
      <button
        type="button"
        className={btnPrimary}
        disabled={loading || invalid}
        onClick={() => void findScenes()}
      >
        {loading ? "Consultando…" : "Consultar"}
        <ArrowRight size={17} />
      </button>
    </>
  );
}
