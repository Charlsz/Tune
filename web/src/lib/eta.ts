/** Estimación del tiempo que falta, a partir de lo que tardaron las fases anteriores. */

export type EtaPhase =
  | { phase: "upload" | "fetch"; loaded: number; total: number }
  | { phase: "check" | "infer" | null };

export type EtaMemory = {
  fetchS: number | null;
  inferS: number | null;
};

const STORE_KEY = "tune-eta-phases";

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function loadEtaMemory(): EtaMemory {
  const raw = storage()?.getItem(STORE_KEY);
  if (!raw) return { fetchS: null, inferS: null };
  try {
    const parsed = JSON.parse(raw) as Partial<EtaMemory>;
    return {
      fetchS: finiteOrNull(parsed.fetchS),
      inferS: finiteOrNull(parsed.inferS),
    };
  } catch {
    return { fetchS: null, inferS: null };
  }
}

/** Media con la medición anterior. La nueva pesa igual que lo ya guardado. */
export function rememberEta(kind: "fetch" | "infer", seconds: number): EtaMemory {
  const current = loadEtaMemory();
  if (!Number.isFinite(seconds) || seconds < 0.5) return current;
  const prev = kind === "fetch" ? current.fetchS : current.inferS;
  const next = prev == null ? seconds : prev * 0.5 + seconds * 0.5;
  const memory: EtaMemory = {
    fetchS: kind === "fetch" ? next : current.fetchS,
    inferS: kind === "infer" ? next : current.inferS,
  };
  try {
    storage()?.setItem(STORE_KEY, JSON.stringify(memory));
  } catch {
    /* sesión sin almacenamiento */
  }
  return memory;
}

function priorFetch(memory: EtaMemory): number {
  return memory.fetchS ?? 30;
}

function priorInfer(memory: EtaMemory, firstRun: boolean): number {
  if (memory.inferS != null) return memory.inferS;
  return firstRun ? 90 : 70;
}

/**
 * Segundos que faltan para terminar el proceso.
 * `scenesAfter` es cuántas escenas quedan después de la actual (0 o 1).
 * Si la inferencia se pasa del presupuesto, este crece despacio.
 */
export function remainingSeconds(
  phase: EtaPhase,
  phaseElapsedS: number,
  firstRun: boolean,
  scenesAfter: number,
  memory: EtaMemory,
  budgetRef: { current: number },
): number {
  const inferLeft = () => {
    if (budgetRef.current <= 0) {
      budgetRef.current = priorInfer(memory, firstRun);
    }
    if (phaseElapsedS > budgetRef.current) {
      const over = phaseElapsedS - budgetRef.current;
      budgetRef.current = phaseElapsedS + Math.max(3, over * 0.15);
    }
    return Math.max(0, budgetRef.current - phaseElapsedS);
  };

  const later =
    Math.max(0, scenesAfter) * (priorFetch(memory) + priorInfer(memory, false));
  // Los pesos solo se pagan una vez, al preparar o recibir la primera imagen.
  const weights =
    firstRun &&
    (phase.phase === "check" || phase.phase === "fetch" || phase.phase === "upload")
      ? 120
      : 0;

  if (phase.phase === "upload" || phase.phase === "fetch") {
    const total = Math.max(phase.total, 1);
    const loaded = Math.min(Math.max(phase.loaded, 0), total);
    const frac = loaded / total;
    let downloadRemain = 0;
    if (frac < 0.999 && phaseElapsedS > 0.25 && loaded > 0) {
      const rate = loaded / phaseElapsedS;
      downloadRemain = rate > 0 ? (total - loaded) / rate : 0;
    } else if (frac < 0.05) {
      downloadRemain = priorFetch(memory);
    }
    const inferPart = frac >= 1 ? inferLeft() : priorInfer(memory, firstRun);
    return downloadRemain + inferPart + later + weights;
  }

  if (phase.phase === "check") {
    return priorFetch(memory) + priorInfer(memory, firstRun) + later + weights + 8;
  }

  return inferLeft() + later;
}

export function formatRemain(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "n/d";
  if (s < 1) return "menos de 1 s";
  if (s < 60) return `${Math.ceil(s)} s`;
  const total = Math.ceil(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h} h ${rm} min`;
  }
  return sec > 0 ? `${m} min ${sec} s` : `${m} min`;
}
