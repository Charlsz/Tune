import { ArrowRight } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import { formatDate } from "../../domain/lab";
import { btnPrimary, emptyBox, sectionGap } from "../ui/classes";
import ResultMetrics from "./ResultMetrics";

export default function ResultsPanel() {
  const { state, patch } = useMapApp();
  const result = state.result;

  return (
    <>
      <h1 className={`m-0 text-[21px] font-semibold tracking-[-0.45px] ${sectionGap}`}>
        Resultados
      </h1>
      {result ? (
        <>
          <div className="mb-6 border-y border-line py-3 text-xs max-[760px]:mb-4">
            <p className="m-0 py-1">
              Antes — {formatDate(result.before.datetime)}
            </p>
            <p className="m-0 py-1">
              Después — {formatDate(result.after.datetime)}
            </p>
          </div>
          <div className="pb-5">
            <strong className="block text-[32px] font-medium tracking-[-1.1px]">
              {result.areaKm2.toLocaleString("es", {
                maximumFractionDigits: 2,
              })}
              <span className="text-[15px] tracking-normal text-fg-soft">
                {" "}
                km²
              </span>
            </strong>
          </div>
          <ResultMetrics metrics={result.metrics} />
          <button
            type="button"
            className={btnPrimary}
            onClick={() => patch({ page: "map" })}
          >
            Ver en el mapa
            <ArrowRight size={16} />
          </button>
        </>
      ) : (
        <p className={emptyBox}>Sin resultado.</p>
      )}
    </>
  );
}
