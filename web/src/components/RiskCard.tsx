import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { fmt } from "../lib/insights";
import type { Forecast, ForecastDay, Place, TaskId } from "../types";
import { Skeleton } from "./Skeleton";

const LEVEL = { bajo: "Bajo", medio: "Medio", alto: "Alto", extremo: "Extremo" } as const;
type Level = keyof typeof LEVEL;
const RANK: Record<Level, number> = { bajo: 0, medio: 1, alto: 2, extremo: 3 };

const HORIZON = 15;

function floodLevel(probability: number): Level {
  if (probability >= 0.6) return "extremo";
  if (probability >= 0.3) return "alto";
  if (probability >= 0.1) return "medio";
  return "bajo";
}

function dayLevel(task: TaskId, day: ForecastDay): Level {
  if (task === "burn_scar") return day.level ?? "bajo";
  return floodLevel(day.probability ?? 0);
}

export function RiskCard({
  task,
  place,
  acquiredAt,
}: {
  task: TaskId;
  place: Place;
  acquiredAt: string | null;
}) {
  const [outlook, setOutlook] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [how, setHow] = useState(false);

  useEffect(() => {
    setOutlook(null);
    setError(null);
    api
      .forecast(task, place, acquiredAt)
      .then(setOutlook)
      .catch((e: Error) => setError(e.message));
  }, [task, place.lat, place.lon, acquiredAt]);

  const days = outlook?.daily ?? [];
  const peakAt = days.reduce<number | null>((best, day, index) => {
    if (best == null) return index;
    return RANK[dayLevel(task, day)] > RANK[dayLevel(task, days[best])] ? index : best;
  }, null);

  return (
    <section className="risk" aria-label="Riesgo en los próximos días">
      <button type="button" className="how" aria-label="Cómo se calcula el riesgo en los próximos días" onClick={() => setHow(true)}>
        <span className="how-title">
          <span>Riesgo en los</span>
          <span>próximos días</span>
        </span>
        <InfoMark />
      </button>
      <p className="caption">
        {acquiredAt
          ? `Día 1 es la toma del ${fmt.day(acquiredAt)}. Los siguientes son los días después de esa imagen.`
          : "La imagen no trae fecha de toma. Día 1 es hoy."}
      </p>
      {error && <p className="caption">{error}</p>}
      {!outlook && !error && (
        <ol className="chips" aria-hidden="true">
          {Array.from({ length: HORIZON }, (_, i) => (
            <li key={i}>
              <Skeleton style={{ height: 11, width: 14, margin: "0 auto" }} />
              <Skeleton style={{ height: 11, width: 28, margin: "4px auto 0" }} />
            </li>
          ))}
        </ol>
      )}
      {outlook && peakAt != null && (
        <>
          <p className="caption">
            El más alto es el día {peakAt + 1}, {LEVEL[dayLevel(task, days[peakAt])]}.
          </p>
          <ol className="chips">
            {days.map((day, index) => {
              const level = dayLevel(task, day);
              const horizon =
                task === "flood" && outlook.probability != null
                  ? ` · ${fmt.pct(outlook.probability, 0)} % de que algún día supere el caudal`
                  : "";
              const detail =
                task === "flood"
                  ? `${fmt.pct(day.probability ?? 0, 0)} % ese día${horizon}`
                  : fmt.num(day.value);
              return (
                <li key={day.date} className={level} title={`Día ${index + 1} · ${fmt.day(day.date)} · ${detail}`}>
                  <span className="num">{index + 1}</span>
                  {LEVEL[level]}
                </li>
              );
            })}
          </ol>
        </>
      )}
      {how && <HowModal task={task} onClose={() => setHow(false)} />}
    </section>
  );
}

function HowModal({ task, onClose }: { task: TaskId; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>("button, a")];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="risk-how"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="result-head">
          <h2 id="risk-how">Cómo se calcula</h2>
          <button type="button" className="close" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {task === "flood" ? <FloodHow /> : <BurnHow />}
        <p className="caption">Prithvi no entra en esta cuenta. Solo clasifica la imagen que ya subiste.</p>
      </div>
    </div>
  );
}

function InfoMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 11v6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" />
    </svg>
  );
}

function FloodHow() {
  return (
    <>
      <p>
        GloFAS simula el caudal del río más grande a unos 5 km del punto. El pronóstico trae 50 versiones
        posibles de los próximos 15 días.
      </p>
      <p>
        Cada día se compara con el percentil 90 del caudal diario de esa celda entre 1984 y 2022. El chip es
        bajo si menos del 10 % de las versiones lo supera, medio por debajo del 30 %, alto por debajo del 60 %
        y extremo desde ahí.
      </p>
    </>
  );
}

function BurnHow() {
  return (
    <>
      <p>
        El índice Hot-Dry-Windy multiplica el déficit de vapor de agua por el viento a 10 m. El pronóstico
        horario viene en kilopascales; el índice usa hectopascales, así que ese valor se multiplica por 10. El
        día se queda con la hora más alta. Son 15 días.
      </p>
      <p>Los cortes, en esa unidad, son 50 (medio), 150 (alto) y 300 (extremo). Por debajo de 50 es bajo.</p>
    </>
  );
}
