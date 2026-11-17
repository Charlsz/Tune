import { ArrowRight, History } from "lucide-react";
import { useNavigate } from "react-router";
import { useMapApp } from "../../app/MapAppProvider";
import { paths } from "../../app/paths";
import { formatAoiCaption } from "../../domain/aoi";
import { formatDate } from "../../domain/lab";
import { btnPrimary, emptyBox, sectionGap } from "../ui/classes";
import FadeIn from "../ui/FadeIn";

export default function SessionHistory() {
  const { state } = useMapApp();
  const navigate = useNavigate();

  return (
    <FadeIn>
      <h1
        className={`m-0 text-[21px] font-semibold tracking-[-0.45px] ${sectionGap}`}
      >
        Historial
      </h1>
      <p className="mb-4 mt-0 text-xs leading-snug text-muted">
        Solo esta sesión en el navegador. No lista análisis previos del
        servidor.
      </p>
      {!state.history.length ? (
        <div className={`${emptyBox} flex flex-col gap-3`}>
          <div className="flex items-start gap-3">
            <History size={18} className="mt-0.5 shrink-0 text-fg-soft" />
            <div>
              <p className="m-0 font-medium text-fg">Sin comparaciones aún</p>
              <p className="mb-0 mt-1 text-[11px] leading-snug">
                Cada análisis completado en Mapa aparecerá aquí con fechas y
                área de agua nueva.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => navigate(paths.map)}
          >
            Empezar en Mapa
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        state.history.map((r, i) => {
          const isCurrent = state.result?.id === r.id;
          const caption = formatAoiCaption(
            isCurrent ? state.label : undefined,
            r.aoi,
          );
          return (
            <div
              key={r.id}
              className="border-b border-line py-4 animate-fade-up"
            >
              <strong className="text-[13px]">{caption}</strong>
              <p className="my-1 text-[11px]">
                {formatDate(r.before.datetime)} → {formatDate(r.after.datetime)}
              </p>
              <small className="text-[10px] text-fg-soft">
                {r.areaKm2.toFixed(2)} km² agua nueva ·{" "}
                {new Date(r.created).toLocaleTimeString("es")}
                {r.metrics?.fusionIou != null
                  ? ` · IoU ${r.metrics.fusionIou.toFixed(2)}`
                  : ""}
                {i === 0 ? " · más reciente" : ""}
              </small>
            </div>
          );
        })
      )}
    </FadeIn>
  );
}
