// Espejo de tune.interfaces.api.schemas

export type TaskId = "flood" | "burn_scar";

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
}
