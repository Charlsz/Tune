import { ArrowRight, History } from "lucide-react";
import { useNavigate } from "react-router";
import { useMapApp } from "../../app/MapAppProvider";
import { paths } from "../../app/paths";
import { formatAoiCaption } from "../../domain/aoi";
import { formatDate } from "../../domain/lab";
import {
  btnPrimary,
  emptyBox,
  panelMeta,
} from "../ui/classes";
import { cn } from "../ui/cn";
import FadeIn from "../ui/FadeIn";
import PanelHeader from "../ui/PanelHeader";

export default function SessionHistory() {
  const { state, restoreAnalysis } = useMapApp();
  const navigate = useNavigate();

  return (
    <FadeIn>
      <PanelHeader title="Historial" icon={History} />
      <p className={`${panelMeta} mb-5`}>
        Solo esta sesión. Elige un análisis para verlo en Resultados y en el
        mapa.
      </p>
      {!state.history.length ? (
        <div className={`${emptyBox} flex flex-col gap-3`}>
          <div className="flex items-start gap-3">
            <History size={18} className="mt-0.5 shrink-0 text-fg-soft" />
            <div>
              <p className="m-0 font-medium text-fg">Sin comparaciones aún</p>
              <p className="mb-0 mt-1 text-[11px] leading-snug">
                Cada Analizar en Mapa guarda aquí la corrida. Luego puedes
                reabrirla para ver máscaras y métricas. Al recargar se vacía.
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
        <ul
          className="m-0 list-none space-y-0 border-t border-line p-0"
          aria-label="Análisis de sesión"
        >
          {state.history.map((r, i) => {
            const active = state.result?.id === r.id;
            return (
              <li key={r.id} className="border-b border-line">
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "w-full cursor-pointer rounded-none border-0 px-3 py-4 text-left transition-colors",
                    active ? "bg-accent-soft" : "bg-transparent hover:bg-accent-soft/60",
                  )}
                  onClick={() => {
                    if (restoreAnalysis(r.id)) navigate(paths.results);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-[13px] font-medium text-ink">
                      {formatAoiCaption(r.label, r.aoi)}
                    </strong>
                    {active ? (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.06em] text-ink-soft">
                        En vista
                      </span>
                    ) : null}
                  </div>
                  <p className="my-1 text-[11px] text-fg">
                    {formatDate(r.before.datetime)} →{" "}
                    {formatDate(r.after.datetime)}
                  </p>
                  <small className="text-[10px] text-fg-soft">
                    {r.areaKm2.toFixed(2)} km² agua nueva ·{" "}
                    {new Date(r.created).toLocaleTimeString("es")}
                    {r.metrics?.fusionIou != null
                      ? ` · IoU ${r.metrics.fusionIou.toFixed(2)}`
                      : ""}
                    {i === 0 ? " · más reciente" : ""}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </FadeIn>
  );
}
