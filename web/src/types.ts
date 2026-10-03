// Espejo de tune.interfaces.api.schemas

export type TaskId = "flood" | "burn_scar";

export interface Place {
  lat: number;
  lon: number;
}

export interface ForecastDay {
  date: string;
  probability: number | null;
  value: number | null;
  level: "bajo" | "medio" | "alto" | "extremo" | null;
}

export interface Forecast {
  task: TaskId;
  source: string;
  note: string;
  cell: Place;
  horizon_days: number;
  probability: number | null;
  level: ForecastDay["level"];
  threshold: number | null;
  threshold_unit: string | null;
  daily: ForecastDay[];
}

export interface TaskInfo {
  id: TaskId;
  label: string;
  model_id: string;
  classes: string[];
}

export interface ExampleScene {
  id: string;
  task: TaskId;
  label: string;
  filename: string;
  size_bytes: number;
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Analysis {
  id: string;
  task: TaskId;
  created_at: string;
  model_id: string;
  input_filename: string;
  width: number;
  height: number;
  valid_pixels: number;
  affected_pixels: number;
  affected_ratio: number;
  affected_area_km2: number | null;
  crs: string | null;
  bounds: Bounds | null;
  latency_s: number;
  artifacts: Record<string, string>;
  acquired_at: string | null;
  metadata: RasterMetadata | Record<string, never>;
  change: ChangeSummary | null;
}

export interface ChangeSummary {
  reference_source: string;
  reference_id: string | null;
  reference_dates: string[];
  new_pixels: number;
  persistent_pixels: number;
  receded_pixels: number;
  compared_pixels: number;
  new_area_km2: number | null;
  persistent_area_km2: number | null;
  receded_area_km2: number | null;
}

export interface BandInfo {
  index: number;
  description: string | null;
  tags: Record<string, string>;
  min: number | null;
  max: number | null;
  mean: number | null;
  used_by_model: boolean;
  model_band: string | null;
}

export interface RasterMetadata {
  driver: string;
  dtype: string | null;
  band_count: number;
  width: number;
  height: number;
  nodata: number | null;
  compression: string | null;
  resolution: [number, number];
  resolution_unit: "m" | "°" | null;
  epsg: number | null;
  center: { lat: number; lon: number } | null;
  sensor: string | null;
  tags: Record<string, string>;
  bands: BandInfo[];
}
