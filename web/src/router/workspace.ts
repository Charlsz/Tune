import type { Dispatch, SetStateAction } from "react";
import { useOutletContext } from "react-router";
import type { AnalyzePhase } from "../api";
import type { Analysis, Place, TaskId, TaskInfo } from "../types";

export type Workspace = {
  tasks: TaskInfo[];
  history: Analysis[] | null;
  selected: Analysis | null;
  busy: boolean;
  phase: AnalyzePhase | null;
  runContext: string | null;
  place: Place | null;
  setPlace: (place: Place | null) => void;
  summaryOpen: boolean;
  setSummaryOpen: Dispatch<SetStateAction<boolean>>;
  firstRun: boolean;
  onAnalyze: (file: File, task: TaskId) => void;
  onExample: (id: string, task: TaskId) => void;
  onCatalogAnalyze: (
    itemId: string,
    task: TaskId,
    at: Place,
    sideKm: number,
    maxCloud: number,
  ) => void;
  onRemove: (analysis: Analysis) => void;
  openAnalysis: (analysis: Analysis) => void;
  closeSelected: () => void;
  goHome: () => void;
};

export function useWorkspace(): Workspace {
  return useOutletContext<Workspace>();
}
