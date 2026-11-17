import {
  Layers,
  Maximize,
  Minimize,
  PanelLeft,
  RectangleHorizontal,
} from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import { formatAoiCaption } from "../../domain/aoi";
import { cn } from "../ui/cn";
import MapView from "./MapView";
import SwipeControl from "./SwipeControl";
import "./leaflet.css";

export default function MapChrome() {
  const {
    state,
    provider,
    drawing,
    setArea,
    setError,
    panelOpen,
    setPanelOpen,
    fullscreen,
    toggleFullscreen,
    patch,
  } = useMapApp();

  const mapCaption = formatAoiCaption(state.label, state.aoi);
  const showName =
    Boolean(state.label?.trim()) && !/^coordenadas$/i.test(state.label.trim());

  return (
    <div className="relative order-2 min-w-0 flex-1 max-sm:order-1 max-sm:h-[48dvh] max-sm:min-h-[360px] max-sm:flex-none">
      <MapView
        state={state}
        drawing={drawing}
        onArea={setArea}
        onError={setError}
        waterCells={provider.maskCells}
      />
      <div
        className="absolute bottom-6 left-1/2 z-[600] flex max-w-[min(90%,28rem)] -translate-x-1/2 items-center gap-2 truncate rounded-sm border border-line bg-[#ffffffef] px-3 py-2 text-[9px] text-fg-muted max-lg:hidden"
        title={mapCaption}
      >
        {showName && (
          <>
            <span className="truncate text-fg">{state.label}</span>
            <span className="shrink-0 text-fg-soft" aria-hidden>
              ·
            </span>
          </>
        )}
        <span className="shrink-0 tabular-nums">
          {formatAoiCaption(undefined, state.aoi)}
        </span>
      </div>
      <div className="absolute top-6 right-6 z-[710] flex flex-col gap-3 max-sm:top-4 max-sm:right-3 max-sm:gap-2.5">
        <button
          type="button"
          aria-label={panelOpen ? "Ocultar panel" : "Mostrar panel"}
          aria-pressed={panelOpen}
          className="flex size-11 cursor-pointer items-center justify-center rounded-md border border-line bg-paper p-0 text-fg shadow-[0_3px_12px_#15324815] max-sm:size-10"
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <Layers size={24} />
        </button>
        <button
          type="button"
          aria-label={
            fullscreen ? "Salir de pantalla completa" : "Pantalla completa"
          }
          className="flex size-11 cursor-pointer items-center justify-center rounded-md border border-line bg-paper p-0 text-fg shadow-[0_3px_12px_#15324815] max-sm:size-10"
          onClick={() => void toggleFullscreen()}
        >
          {fullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
        </button>
      </div>
      <div
        className="absolute top-6 right-[5.5rem] z-[650] flex rounded-sm border border-line bg-paper p-0.5 shadow-[0_2px_8px_#15324812] max-sm:top-auto max-sm:right-auto max-sm:bottom-6 max-sm:left-3.5"
        aria-label="Variante"
      >
        <button
          type="button"
          aria-pressed={state.variant === "floating"}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-sm border-0 px-2 py-1.5 text-[10px]",
            state.variant === "floating"
              ? "bg-accent-soft text-ink"
              : "bg-transparent text-fg-muted",
          )}
          onClick={() => patch({ variant: "floating" })}
        >
          <RectangleHorizontal size={16} /> A
        </button>
        <button
          type="button"
          aria-pressed={state.variant === "sidebar"}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-sm border-0 px-2 py-1.5 text-[10px]",
            state.variant === "sidebar"
              ? "bg-accent-soft text-ink"
              : "bg-transparent text-fg-muted",
          )}
          onClick={() => patch({ variant: "sidebar" })}
        >
          <PanelLeft size={16} /> B
        </button>
      </div>
      <SwipeControl />
    </div>
  );
}
