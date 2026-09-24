import type { Analysis, TaskId } from "../types";

export const TASK_META: Record<TaskId, { name: string; dataset: string }> = {
  flood: { name: "Inundación", dataset: "Sen1Floods11" },
  burn_scar: { name: "Cicatriz de incendio", dataset: "HLS Burn Scars" },
};

// Sin área de la API (raster sin tamaño de píxel métrico) se aproxima con la caja WGS84.
export function affectedKm2(a: Analysis): { value: number | null; estimated: boolean } {
  if (a.affected_area_km2 != null) return { value: a.affected_area_km2, estimated: false };
  if (!a.bounds || !a.width || !a.height) return { value: null, estimated: false };
  const lat = (a.bounds.north + a.bounds.south) / 2;
  const w = (a.bounds.east - a.bounds.west) * 111.32 * Math.cos((lat * Math.PI) / 180);
  const h = (a.bounds.north - a.bounds.south) * 110.57;
  return { value: (w * h * a.affected_pixels) / (a.width * a.height), estimated: true };
}

export function crsLabel(crs: string | null): string {
  if (!crs) return "Sin CRS";
  if (/^EPSG:\d+$/i.test(crs)) return crs.toUpperCase();
  const epsg = crs.match(/AUTHORITY\["EPSG","(\d+)"\]\]\s*$/);
  if (epsg) return `EPSG:${epsg[1]}`;
  return crs.match(/^\w+\["([^"]+)"/)?.[1] ?? crs.slice(0, 24);
}

export function osmUrl(a: Analysis): string | null {
  if (!a.bounds) return null;
  const lat = (a.bounds.north + a.bounds.south) / 2;
  const lon = (a.bounds.east + a.bounds.west) / 2;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=11/${lat}/${lon}`;
}

export const fmt = {
  pct: (r: number, digits = 1) => (r * 100).toFixed(digits),
  int: (n: number) => n.toLocaleString("es-CO"),
  km2: (n: number) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)),
  coord: (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`,
  secs(s: number) {
    if (s < 60) return `${s.toFixed(1)} s`;
    const m = Math.floor(s / 60);
    return `${m} min ${Math.round(s - m * 60)} s`;
  },
  bytes: (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`),
  ago(iso: string) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return "Ahora";
    if (s < 3600) return `Hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `Hace ${Math.floor(s / 3600)} h`;
    return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  },
};
