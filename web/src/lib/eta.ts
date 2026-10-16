/** Estimación adaptativa del tiempo que falta para terminar todo el proceso. */

export type EtaPhase =
  | { phase: "upload" | "fetch"; loaded: number; total: number }
  | { phase: "check" | "infer" | null };

/**
 * Calcula segundos restantes del proceso completo.
 * - En descarga/subida: resto del archivo (por velocidad) + presupuesto de análisis.
 * - En análisis: presupuesto que se ajusta si la corrida se alarga.
 */
export function remainingSeconds(
  phase: EtaPhase,
  _elapsedS: number,
  phaseElapsedS: number,
  firstRun: boolean,
  budgetRef: { current: number },
): number {
  const inferBudget = () => {
    if (budgetRef.current <= 0) {
      budgetRef.current = firstRun ? 420 : 70;
    }
    // Si ya pasamos el presupuesto, estíralo un poco para no mostrar 0 prematuro.
    if (phaseElapsedS > budgetRef.current * 0.92) {
      budgetRef.current = Math.max(budgetRef.current, phaseElapsedS / 0.88);
    }
    return Math.max(0, budgetRef.current - phaseElapsedS);
  };

  if (phase.phase === "upload" || phase.phase === "fetch") {
    const total = Math.max(phase.total, 1);
    const loaded = Math.min(phase.loaded, total);
    const frac = loaded / total;
    let downloadRemain = 0;
    if (frac < 0.999 && phaseElapsedS > 0.25 && loaded > 0) {
      const rate = loaded / phaseElapsedS;
      downloadRemain = rate > 0 ? (total - loaded) / rate : 0;
    }
    const inferGuess = firstRun ? 420 : 70;
    return downloadRemain + (frac >= 1 ? inferBudget() : inferGuess);
  }

  if (phase.phase === "check") {
    return (firstRun ? 420 : 70) + 8;
  }

  // infer o sin fase aún
  return inferBudget();
}

export function formatRemain(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "—";
  if (s < 1) return "menos de 1 s";
  if (s < 60) return `${Math.ceil(s)} s`;
  const m = Math.floor(s / 60);
  const sec = Math.ceil(s - m * 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h} h ${rm} min`;
  }
  return sec > 0 ? `${m} min ${sec} s` : `${m} min`;
}
