import { useEffect, useRef, useState } from "react";
import { useMapApp } from "../../app/MapAppProvider";
import {
  formatRemain,
  loadEtaMemory,
  rememberEta,
  remainingSeconds,
  type EtaMemory,
} from "../../lib/eta";
import { cn } from "../ui/cn";

const STEPS = [
  { id: "prepare" as const, label: "Preparar" },
  { id: "fetch" as const, label: "Recibir imagen" },
  { id: "infer" as const, label: "Ejecutar modelo" },
];

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m} min ${r} s` : `${m} min`;
}

export default function AnalyzeRunning() {
  const { analyzeProgress } = useMapApp();
  const [t0] = useState(() => Date.now());
  const [now, setNow] = useState(t0);
  const [phaseStarted, setPhaseStarted] = useState(t0);
  const [phaseKey, setPhaseKey] = useState("");
  const [memory, setMemory] = useState<EtaMemory>(() => loadEtaMemory());
  const budget = useRef(0);
  const firstRun = useRef(
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("tune-weights-ready") !== "1"
      : true,
  );

  const scene = analyzeProgress?.scene ?? "before";
  const phase = analyzeProgress?.phase ?? "prepare";
  const total = analyzeProgress?.of ?? 2;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const key = `${scene}:${phase}`;
    if (key === phaseKey) return;
    if (phaseKey) {
      const prevName = phaseKey.split(":")[1];
      const dur = (Date.now() - phaseStarted) / 1000;
      if (prevName === "fetch" || prevName === "infer") {
        setMemory(rememberEta(prevName, dur));
      }
    }
    setPhaseKey(key);
    setPhaseStarted(Date.now());
    budget.current = 0;
  }, [scene, phase, phaseKey, phaseStarted]);

  useEffect(() => {
    return () => {
      try {
        sessionStorage.setItem("tune-weights-ready", "1");
      } catch {
        /* ignore */
      }
    };
  }, []);

  const phaseElapsedS = (now - phaseStarted) / 1000;
  const etaPhase =
    phase === "fetch"
      ? {
          phase: "fetch" as const,
          loaded: analyzeProgress?.loaded ?? 0,
          total: Math.max(analyzeProgress?.total ?? 1, 1),
        }
      : { phase: phase === "prepare" ? ("check" as const) : ("infer" as const) };

  const scenesAfter = scene === "before" && total === 2 ? 1 : 0;
  const remain = remainingSeconds(
    etaPhase,
    phaseElapsedS,
    firstRun.current,
    scenesAfter,
    memory,
    budget,
  );

  const activeIdx = STEPS.findIndex((s) => s.id === phase);
  const sceneLabel = total === 1 ? "Archivo" : scene === "before" ? "Antes" : "Después";
  const sceneIndex = total === 1 ? 1 : scene === "before" ? 1 : 2;
  const fetchPct =
    phase === "fetch" && analyzeProgress?.total
      ? Math.min(
          100,
          Math.round(
            ((analyzeProgress.loaded ?? 0) / Math.max(analyzeProgress.total, 1)) *
              100,
          ),
        )
      : null;

  return (
    <div
      className="my-5 animate-fade-up rounded-sm bg-accent-soft  p-5"
      role="status"
      aria-live="polite"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="tune-spinner shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="m-0 text-[13px] font-medium text-ink">Analizando…</p>
          <p className="m-0 mt-1 text-[11px] text-fg-muted">
            Escena {sceneIndex}/{total} · {sceneLabel}
            {analyzeProgress?.detail ? ` — ${analyzeProgress.detail}` : ""}
          </p>
        </div>
      </div>

      <ol className="m-0 mb-4 list-none space-y-2 p-0">
        {STEPS.map((s, i) => {
          const status =
            i < activeIdx ? "done" : i === activeIdx ? "active" : "pending";
          return (
            <li key={s.id} className="flex items-center gap-2.5 text-[12px]">
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px]",
                  status === "done" && "border-ink bg-ink text-paper",
                  status === "active" && "border-ink bg-paper text-ink",
                  status === "pending" && "border-line bg-paper text-fg-soft",
                )}
              >
                {status === "done" ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  status === "active" && "font-medium text-ink",
                  status === "pending" && "text-fg-soft",
                  status === "done" && "text-fg-muted",
                )}
              >
                {s.label}
                {status === "active" && fetchPct != null ? ` · ${fetchPct}%` : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-muted">
        <span>
          Transcurrido:{" "}
          <strong className="font-medium text-fg">
            {formatElapsed(now - t0)}
          </strong>
        </span>
        <span>
          Queda ~{" "}
          <strong className="font-medium text-fg">{formatRemain(remain)}</strong>
        </span>
      </div>
      <p className="mb-0 mt-3 text-[10px] leading-snug text-fg-soft">
        En CPU la primera corrida descarga el modelo; puede tardar varios minutos.
      </p>
    </div>
  );
}
