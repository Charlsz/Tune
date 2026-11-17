import { useMapApp } from "../../app/MapAppProvider";
import { formatDate } from "../../domain/lab";
import { emptyBox, sectionGap } from "../ui/classes";

export default function SessionHistory() {
  const { state } = useMapApp();

  return (
    <>
      <h1 className={`m-0 text-[21px] font-semibold tracking-[-0.45px] ${sectionGap}`}>
        Historial
      </h1>
      <p className="mb-4 mt-0 text-xs leading-snug text-muted">
        Solo esta sesión. Los análisis del servidor no se listan aquí.
      </p>
      {!state.history.length ? (
        <p className={emptyBox}>Sin comparaciones aún.</p>
      ) : (
        state.history.map((r, i) => (
          <div key={r.id} className="border-b border-line py-4">
            <strong className="text-[13px]">
              Comparación {state.history.length - i}
            </strong>
            <p className="my-1 text-[11px]">
              {formatDate(r.before.datetime)} → {formatDate(r.after.datetime)}
            </p>
            <small className="text-[10px] text-fg-soft">
              {r.areaKm2.toFixed(2)} km² ·{" "}
              {new Date(r.created).toLocaleTimeString("es")}
              {r.metrics?.fusionIou != null
                ? ` · IoU ${r.metrics.fusionIou.toFixed(2)}`
                : ""}
            </small>
          </div>
        ))
      )}
    </>
  );
}
