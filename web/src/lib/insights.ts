// Todo lo que se deduce de un Analysis sin pedirle nada nuevo a la API.
import type { Analysis, TaskId } from "../types";

export const WINDOW = 512;

export const TASK_META: Record<TaskId, { code: string; name: string; accent: string }> = {
  flood: { code: "FLD", name: "Inundación", accent: "var(--flood)" },
  burn_scar: { code: "BRN", name: "Cicatriz de incendio", accent: "var(--burn)" },
};

export type Severity = { label: string; level: 0 | 1 | 2 | 3 };

export function severity(ratio: number): Severity {
  if (ratio < 0.05) return { label: "Mínimo", level: 0 };
  if (ratio < 0.2) return { label: "Moderado", level: 1 };
  if (ratio < 0.5) return { label: "Alto", level: 2 };
  return { label: "Severo", level: 3 };
}

export interface Insights {
  totalPixels: number;
  coverage: number;
  nodataPixels: number;
  pixelAreaM2: number | null;
  gsdM: number | null;
  validAreaKm2: number | null;
  affectedAreaKm2: number | null;
  areaEstimated: boolean;
  clearAreaKm2: number | null;
  center: { lat: number; lon: number } | null;
  extentKm: { w: number; h: number } | null;
  windows: number;
  throughputMpx: number | null;
  crsLabel: string;
  scene: SceneTag;
}

export function insights(a: Analysis): Insights {
  const totalPixels = a.width * a.height;
  const coverage = totalPixels ? a.valid_pixels / totalPixels : 0;
  const center = a.bounds
    ? { lat: (a.bounds.north + a.bounds.south) / 2, lon: (a.bounds.east + a.bounds.west) / 2 }
    : null;
  const extentKm =
    a.bounds && center
      ? {
          w: (a.bounds.east - a.bounds.west) * 111.32 * Math.cos((center.lat * Math.PI) / 180),
          h: (a.bounds.north - a.bounds.south) * 110.57,
        }
      : null;

  let pixelAreaM2: number | null = null;
  if (a.affected_area_km2 != null && a.affected_pixels > 0) {
    pixelAreaM2 = (a.affected_area_km2 * 1e6) / a.affected_pixels;
  } else if (extentKm && totalPixels) {
    pixelAreaM2 = (extentKm.w * extentKm.h * 1e6) / totalPixels;
  }
  const km2 = (px: number) => (pixelAreaM2 != null ? (px * pixelAreaM2) / 1e6 : null);

  return {
    totalPixels,
    coverage,
    nodataPixels: totalPixels - a.valid_pixels,
    pixelAreaM2,
    gsdM: pixelAreaM2 != null ? Math.sqrt(pixelAreaM2) : null,
    validAreaKm2: km2(a.valid_pixels),
    affectedAreaKm2: a.affected_area_km2 ?? km2(a.affected_pixels),
    areaEstimated: a.affected_area_km2 == null && pixelAreaM2 != null,
    clearAreaKm2: km2(a.valid_pixels - a.affected_pixels),
    center,
    extentKm,
    windows: Math.ceil(a.width / WINDOW) * Math.ceil(a.height / WINDOW),
    throughputMpx: a.latency_s >= 0.05 ? totalPixels / 1e6 / a.latency_s : null,
    crsLabel: crsLabel(a.crs),
    scene: parseScene(a.input_filename),
  };
}

export function crsLabel(crs: string | null): string {
  if (!crs) return "Sin CRS";
  if (/^EPSG:\d+$/i.test(crs)) return crs.toUpperCase();
  const epsg = crs.match(/AUTHORITY\["EPSG","(\d+)"\]\]\s*$/);
  const name = crs.match(/^\w+\["([^"]+)"/);
  if (name && epsg) return `${name[1]} · EPSG:${epsg[1]}`;
  return name?.[1] ?? crs.slice(0, 32);
}

export interface SceneTag {
  sensor: string | null;
  tile: string | null;
  date: string | null;
  region: string | null;
  source: string | null;
}

// Nombres HLS (HLS.S30.T10SEH.2018190...) y Sen1Floods11 (India_900498_S2Hand).
export function parseScene(filename: string): SceneTag {
  const tag: SceneTag = { sensor: null, tile: null, date: null, region: null, source: null };
  const hls = filename.match(/HLS\.(S30|L30)\.(T\w{5})\.(\d{4})(\d{3})/);
  if (hls) {
    tag.sensor = hls[1] === "S30" ? "Sentinel-2 (HLS S30)" : "Landsat 8/9 (HLS L30)";
    tag.tile = hls[2];
    tag.date = fromJulian(Number(hls[3]), Number(hls[4]));
    tag.source = "HLS Burn Scars";
    return tag;
  }
  const s1f = filename.match(/^([A-Za-z-]+)_(\d+)_S2Hand/);
  if (s1f) {
    tag.region = s1f[1].replace(/-/g, " ");
    tag.sensor = "Sentinel-2";
    tag.tile = `chip ${s1f[2]}`;
    tag.source = "Sen1Floods11 · etiquetado manual";
    return tag;
  }
  const iso = filename.match(/(\d{4})(\d{2})(\d{2})T\d{6}/);
  if (iso) tag.date = `${iso[1]}-${iso[2]}-${iso[3]}`;
  return tag;
}

function fromJulian(year: number, doy: number): string {
  const d = new Date(Date.UTC(year, 0, doy));
  return d.toISOString().slice(0, 10);
}

// --- formato ----------------------------------------------------------------

export const fmt = {
  pct: (r: number, digits = 1) => `${(r * 100).toFixed(digits)}`,
  int: (n: number) => n.toLocaleString("es-CO"),
  km2: (n: number | null) =>
    n == null ? "—" : n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2),
  coord(v: number, pos: string, neg: string) {
    return `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
  },
  secs(s: number) {
    if (s < 60) return `${s.toFixed(1)} s`;
    const m = Math.floor(s / 60);
    return `${m} min ${Math.round(s - m * 60)} s`;
  },
  bytes(n: number) {
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  },
  ago(iso: string) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return "ahora";
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
  },
};
