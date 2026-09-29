import { useEffect, useState } from "react";
import { api } from "../api";
import { fmt } from "../lib/insights";
import type { Forecast, Place, TaskId } from "../types";
import { Skeleton } from "./Skeleton";

const LEVEL = { bajo: "Bajo", medio: "Medio", alto: "Alto", extremo: "Extremo" } as const;

const SKEL_SPARK = [40, 70, 55, 80, 35, 65, 50];

export function RiskCard({ task, place }: { task: TaskId; place: Place }) {
  const [outlook, setOutlook] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOutlook(null);
    setError(null);
    api
      .forecast(task, place)
      .then(setOutlook)
      .catch((e: Error) => setError(e.message));
  }, [task, place.lat, place.lon]);

  return (
    <section className="section" aria-label="Riesgo futuro">
      <h2>Riesgo futuro</h2>
      <p className="caption">Prithvi mira la imagen de hoy. Esto es un pronóstico meteorológico del punto.</p>
      {error && <p className="caption">{error}</p>}
      {!outlook && !error && (
        <>
          <Skeleton style={{ height: 56, width: 120, borderRadius: 6 }} />
          <Skeleton style={{ height: 12, width: "80%", marginTop: 4 }} />
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 36, marginTop: 4 }}>
            {SKEL_SPARK.map((h, i) => (
              <Skeleton key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 1 }} />
            ))}
          </div>
        </>
      )}
      {outlook?.task === "flood" && outlook.probability != null && (
        <>
          <div className="figure num">
            {fmt.pct(outlook.probability, 0)}
            <span>%</span>
          </div>
          <p className="caption">
            de que el caudal supere {fmt.num(outlook.threshold)} {outlook.threshold_unit} en los próximos{" "}
            {outlook.horizon_days} días
          </p>
          <ol className="spark" aria-label="Probabilidad por día">
            {outlook.daily.map((day) => (
              <li key={day.date} title={`${fmt.day(day.date)} · ${fmt.pct(day.probability ?? 0, 0)} %`}>
                <i style={{ height: `${Math.max(2, (day.probability ?? 0) * 100)}%` }} />
              </li>
            ))}
          </ol>
          <p className="caption">{outlook.note}</p>
        </>
      )}
      {outlook?.task === "burn_scar" && (
        <>
          <p className="caption">
            El día más severo es <strong>{outlook.level ? LEVEL[outlook.level] : "—"}</strong>, en{" "}
            {outlook.horizon_days} días.
          </p>
          <ol className="chips">
            {outlook.daily.map((day) => (
              <li key={day.date} className={day.level ?? "bajo"} title={`${day.date} · ${fmt.num(day.value)}`}>
                <span className="num">{day.date.slice(8)}</span>
                {day.level ? LEVEL[day.level] : "—"}
              </li>
            ))}
          </ol>
          <p className="caption">{outlook.note}</p>
        </>
      )}
    </section>
  );
}
