/**
 * Estado del flujo MapApp (área → fechas → escenas → resultado).
 * No es el laboratorio MLOps de `lab/` en la raíz del repo.
 */
import type { BBox } from "./aoi";
import type { CatalogScene, PipelineLayerStatus } from "../types";
export type Mode = "before" | "after" | "change" | "agree";
export type Step =
  "area" | "dates" | "scenes" | "ready" | "running" | "results";
export interface Scene extends CatalogScene {
  image: string;
  water: boolean[];
  demo?: boolean;
}
export interface Cell {
  bbox: BBox;
  areaKm2: number;
}
export interface ResultOverlays {
  bounds: BBox;
  beforePreview?: string;
  afterPreview?: string;
  beforeMask?: string;
  afterMask?: string;
  change?: string;
  /** PNG de acuerdo Tune↔GFM cuando el backend encontró capa. */
  fusion?: string;
}
export interface ExposureClassMetric {
  label: string;
  areaKm2: number | null;
  fraction: number;
}

export interface ResultMetrics {
  detectedKm2: number | null;
  newKm2: number | null;
  persistentKm2: number | null;
  recededKm2: number | null;
  population: number | null;
  cover: ExposureClassMetric[];
  modelId: string;
  /** IoU con GFM/OPERA si hubo observación; null si no hubo capa. */
  fusionIou: number | null;
  fusionSources: string[];
  observation: PipelineLayerStatus | null;
}

export interface Result {
  id: string;
  key: string;
  before: Scene;
  after: Scene;
  cells: Cell[];
  areaKm2: number;
  created: string;
  aoi: BBox;
  /** Nombre del lugar o “Coordenadas” al momento del análisis. */
  label?: string;
  overlays?: ResultOverlays;
  metrics?: ResultMetrics;
}
/** Progreso de analyze (stream NDJSON × 2 escenas). */
export type AnalyzeProgressEvent = {
  scene: "before" | "after";
  phase: "prepare" | "fetch" | "infer";
  loaded?: number;
  total?: number;
  detail?: string;
};

export interface DataProvider {
  places: { label: string; bbox: BBox }[];
  maskCells(scene: Scene, aoi: BBox): Cell[];
  scenes(aoi: BBox, date: string): Promise<Scene[]>;
  analyze(
    aoi: BBox,
    before: Scene,
    after: Scene,
    onProgress?: (e: AnalyzeProgressEvent) => void,
  ): Promise<Result>;
}
export interface State {
  aoi: BBox;
  label: string;
  dates: [string, string];
  selected: [Scene | null, Scene | null];
  step: Step;
  mode: Mode;
  mask: boolean;
  opacity: number;
  slider: boolean;
  split: number;
  variant: "floating" | "sidebar";
  page: "map" | "results" | "history";
  result: Result | null;
  history: Result[];
}
/** AOI inicial ~20 km (cabe en TUNE_CATALOG_MAX_KM). */
export const initialState: State = {
  aoi: [67.845, 27.01, 68.055, 27.19],
  label: "Sindh, Pakistán",
  dates: ["2022-05-18", "2022-09-05"],
  selected: [null, null],
  step: "area",
  mode: "change",
  mask: true,
  opacity: 0.7,
  slider: false,
  split: 50,
  variant: "floating",
  page: "map",
  result: null,
  history: [],
};
export function selectionKey(aoi: BBox, before: Scene, after: Scene) {
  return JSON.stringify([aoi, before.id, after.id]);
}
export type Action =
  | { type: "area"; bbox: BBox; label: string }
  | { type: "date"; index: 0 | 1; value: string }
  | { type: "scene"; index: 0 | 1; scene: Scene }
  | { type: "step"; step: Step }
  | { type: "result"; result: Result }
  | {
      type: "view";
      patch: Partial<
        Pick<
          State,
          "mode" | "mask" | "opacity" | "slider" | "split" | "variant" | "page"
        >
      >;
    };
export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "area":
      return {
        ...s,
        aoi: a.bbox,
        label: a.label,
        selected: [null, null],
        result: null,
        step: "area",
        slider: false,
      };
    case "date": {
      const dates: [string, string] = [...s.dates];
      dates[a.index] = a.value;
      return {
        ...s,
        dates,
        selected: [null, null],
        result: null,
        step: "dates",
        slider: false,
      };
    }
    case "scene": {
      const selected: [Scene | null, Scene | null] = [...s.selected];
      selected[a.index] = a.scene;
      return { ...s, selected, result: null, step: "scenes", slider: false };
    }
    case "step":
      return { ...s, step: a.step };
    case "result":
      if (
        !s.selected[0] ||
        !s.selected[1] ||
        a.result.key !== selectionKey(s.aoi, s.selected[0], s.selected[1])
      )
        return s;
      {
        const labeled: Result = {
          ...a.result,
          label: a.result.label?.trim() || s.label,
        };
        return {
          ...s,
          result: labeled,
          history: [labeled, ...s.history],
          step: "results",
          mode: "change",
          mask: true,
          slider: false,
        };
      }
    case "view":
      return {
        ...s,
        ...a.patch,
        opacity: Math.max(0, Math.min(1, a.patch.opacity ?? s.opacity)),
        split: Math.max(0, Math.min(100, a.patch.split ?? s.split)),
      };
  }
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}
