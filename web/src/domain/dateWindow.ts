/** Ventana de búsqueda Sentinel-2: 7 días inclusivos desde un inicio. */
export const WEEK_DAYS = 7;

/** Suma días a una fecha ISO `YYYY-MM-DD` (UTC). */
export function addDays(isoDate: string, days: number): string {
  const t = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(t)) return isoDate;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

/** Fin inclusivo de la semana que empieza en `start`. */
export function weekEnd(start: string): string {
  return addDays(start, WEEK_DAYS - 1);
}

/** Rango STAC `[start, end]` para una semana de 7 días. */
export function weekWindow(start: string): { start: string; end: string } {
  return { start, end: weekEnd(start) };
}

/**
 * Las semanas no deben solaparse: Después empieza el día siguiente
 * al fin de la semana Antes (o más tarde).
 */
export function weekWindowsValid(
  beforeStart: string,
  afterStart: string,
): boolean {
  if (!beforeStart || !afterStart) return false;
  const beforeEnds = weekEnd(beforeStart);
  return afterStart > beforeEnds;
}

/** Texto corto del rango, p. ej. para el panel. */
export function formatWeekRange(
  start: string,
  formatDay: (iso: string) => string,
): string {
  if (!start) return "";
  const end = weekEnd(start);
  if (start === end) return formatDay(start);
  return `${formatDay(start)} – ${formatDay(end)}`;
}

/** True si `isoDay` cae dentro de la semana que empieza en `start`. */
export function dateInWeek(isoDay: string, weekStart: string): boolean {
  if (!isoDay || !weekStart) return false;
  const day = isoDay.slice(0, 10);
  const { start, end } = weekWindow(weekStart);
  return day >= start && day <= end;
}
