import { ArrowLeftRight, ArrowRight, FileUp, Map as MapIcon, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/client";
import { useMapApp } from "../../app/MapAppProvider";
import { paths } from "../../app/paths";
import {
  boxToBBox,
  boxesClose,
  canPlaceOnMap,
  preferEarlierFirst,
  sameTerritory,
  unionBox,
  type Box,
} from "../../domain/territory";
import { formatDate } from "../../domain/lab";
import type { InspectReport } from "../../types";
import { btnOutline, btnPrimary, btnText, emptyBox } from "../ui/classes";
import AnalyzeRunning from "./AnalyzeRunning";

const MAX_BYTES = 200 * 1024 * 1024;

type Slot = {
  file: File;
  status: "checking" | "ok" | "error";
  report?: InspectReport;
  detail?: string;
};

function isTiff(file: File): boolean {
  return /\.tiff?$/i.test(file.name);
}

function dateLabel(report: InspectReport | undefined): string | null {
  const day = report?.acquired_at;
  if (!day) return null;
  return formatDate(day);
}

export default function GeoTiffUpload() {
  const { analyzeUploads, analyzeProgress, error, setError, setArea, state } =
    useMapApp();
  const navigate = useNavigate();
  const [antes, setAntes] = useState<Slot | null>(null);
  const [despues, setDespues] = useState<Slot | null>(null);
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);

  const overlapProblem = useMemo(() => {
    const a = antes?.report?.bounds;
    const b = despues?.report?.bounds;
    if (!a || !b) {
      if (antes?.status === "ok" && despues?.status === "ok") {
        return "Los dos archivos necesitan georreferencia para compararlos.";
      }
      return "";
    }
    return sameTerritory(a as Box, b as Box)
      ? ""
      : "Estos archivos no cubren el mismo lugar. Sube dos recortes del mismo terreno.";
  }, [antes, despues]);

  const placeable = useMemo(() => {
    const busy =
      antes?.status === "checking" || despues?.status === "checking";
    const slots = [antes, despues].filter(
      (s): s is Slot => s?.status === "ok" && canPlaceOnMap(s.report?.bounds),
    );
    const filled = [antes, despues].filter((s) => s?.status === "ok");
    if (busy || overlapProblem || !filled.length || slots.length !== filled.length) {
      return null;
    }
    const boxes = slots.map((s) => s.report!.bounds as Box);
    const box = boxes.length === 2 ? unionBox(boxes[0]!, boxes[1]!) : boxes[0]!;
    return {
      box,
      targets: [boxToBBox(box), ...boxes.map(boxToBBox)],
      label: slots.map((s) => s.file.name).join(" → "),
    };
  }, [antes, despues, overlapProblem]);

  const ready =
    !running &&
    (antes?.status === "ok" || despues?.status === "ok") &&
    antes?.status !== "checking" &&
    despues?.status !== "checking" &&
    antes?.status !== "error" &&
    despues?.status !== "error" &&
    !overlapProblem;

  async function take(slot: "antes" | "despues", file: File | undefined) {
    setError("");
    setNote("");
    if (!file) return;
    if (!isTiff(file)) {
      const bad: Slot = {
        file,
        status: "error",
        detail: "Se espera un GeoTIFF (.tif o .tiff).",
      };
      if (slot === "antes") setAntes(bad);
      else setDespues(bad);
      return;
    }
    if (file.size > MAX_BYTES) {
      const bad: Slot = {
        file,
        status: "error",
        detail: "El archivo supera 200 MB.",
      };
      if (slot === "antes") setAntes(bad);
      else setDespues(bad);
      return;
    }
    const pending: Slot = { file, status: "checking" };
    if (slot === "antes") setAntes(pending);
    else setDespues(pending);
    try {
      const report = await api.inspect(file);
      const next: Slot = report.accepted
        ? { file, status: "ok", report, detail: report.detail ?? undefined }
        : {
            file,
            status: "error",
            report,
            detail: report.detail ?? "El GeoTIFF no cumple el contrato de bandas.",
          };
      if (slot === "antes") setAntes(next);
      else setDespues(next);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "No se pudo leer el archivo.";
      const failed: Slot = { file, status: "error", detail };
      if (slot === "antes") setAntes(failed);
      else setDespues(failed);
    }
  }

  function swap() {
    setAntes(despues);
    setDespues(antes);
    setNote("");
  }

  function showOnMap() {
    if (!placeable) return;
    const current = state.result?.overlays?.bounds ?? state.result?.aoi;
    const alreadyThere =
      current != null &&
      placeable.targets.some((target) => boxesClose(current, target));
    if (!alreadyThere) setArea(boxToBBox(placeable.box), placeable.label);
    navigate(paths.map);
  }

  async function run() {
    const filled = [antes, despues].filter((s): s is Slot => s?.status === "ok");
    if (!filled.length || overlapProblem) return;
    let first = filled[0];
    let second = filled[1] ?? null;
    if (first && second && first.report && second.report) {
      const ordered = preferEarlierFirst(
        { slot: first, acquiredAt: first.report.acquired_at },
        { slot: second, acquiredAt: second.report.acquired_at },
      );
      if (ordered.reordered) {
        setAntes(ordered.before.slot);
        setDespues(ordered.after.slot);
        setNote("Tune ordenó los archivos por fecha: el más antiguo queda en Antes.");
      }
      first = ordered.before.slot;
      second = ordered.after.slot;
    }
    setRunning(true);
    setError("");
    const ok = await analyzeUploads(first.file, second ? second.file : null);
    setRunning(false);
    if (ok) navigate(paths.results);
  }

  if (running || analyzeProgress) {
    return <AnalyzeRunning />;
  }

  return (
    <div>
      <p className="mb-4 mt-0 text-[12px] leading-relaxed text-fg-muted">
        Un archivo analiza esa escena. Dos archivos, del mismo lugar y fechas
        distintas, calculan el agua nueva del más reciente.
      </p>
      <SlotField label="Antes" slot={antes} onFile={(f) => void take("antes", f)} onClear={() => setAntes(null)} />
      <SlotField
        label="Después"
        slot={despues}
        onFile={(f) => void take("despues", f)}
        onClear={() => setDespues(null)}
      />
      {antes?.status === "ok" && despues?.status === "ok" ? (
        <button type="button" className={btnText} onClick={swap}>
          <ArrowLeftRight size={14} />
          Intercambiar
        </button>
      ) : null}
      {note ? <p className="mb-0 mt-2 text-[12px] leading-snug text-fg">{note}</p> : null}
      {overlapProblem ? (
        <p className="mb-0 mt-2 text-[12px] leading-snug text-danger">{overlapProblem}</p>
      ) : null}
      {error ? <p className="mb-0 mt-2 text-[12px] leading-snug text-danger">{error}</p> : null}
      <button type="button" className={btnPrimary} disabled={!ready} onClick={() => void run()}>
        Analizar
        <ArrowRight size={17} />
      </button>
      {placeable ? (
        <button type="button" className={`${btnOutline} mt-3`} onClick={showOnMap}>
          <MapIcon size={17} />
          Mostrar en el mapa
        </button>
      ) : null}
    </div>
  );
}

function SlotField({
  label,
  slot,
  onFile,
  onClear,
}: {
  label: string;
  slot: Slot | null;
  onFile: (file: File | undefined) => void;
  onClear: () => void;
}) {
  const day = dateLabel(slot?.report);
  return (
    <label className={`${emptyBox} mb-3 block cursor-pointer`}>
      <span className="mb-1 block text-[11px] text-fg-soft">{label}</span>
      {slot ? (
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <strong className="block truncate text-[13px] font-medium text-fg">
              {slot.file.name}
            </strong>
            <span className="mt-1 block text-[11px] text-fg-muted">
              {slot.status === "checking"
                ? "Leyendo…"
                : day
                  ? day
                  : slot.status === "ok"
                    ? "Sin fecha en el archivo"
                    : ""}
            </span>
            {slot.detail ? (
              <span
                className={`mt-1 block text-[12px] leading-snug ${
                  slot.status === "error" ? "text-danger" : "text-fg-muted"
                }`}
              >
                {slot.detail}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            className="shrink-0 border-0 bg-transparent p-1 text-fg-soft"
            aria-label={`Quitar ${label}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClear();
            }}
          >
            <X size={16} />
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-2 text-[13px] text-fg">
          <FileUp size={16} />
          Elegir .tif
        </span>
      )}
      <input
        type="file"
        accept=".tif,.tiff,image/tiff"
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}
