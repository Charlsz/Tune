import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DomEvent } from "leaflet";
import { useMap } from "react-leaflet";
import type { BBox } from "../../domain/aoi";
import { useMapApp } from "../../app/MapAppProvider";

type Box = { left: number; top: number; width: number; height: number };

function aoiContainerBox(map: ReturnType<typeof useMap>, aoi: BBox): Box | null {
  const [west, south, east, north] = aoi;
  const sw = map.latLngToContainerPoint([south, west]);
  const ne = map.latLngToContainerPoint([north, east]);
  const left = Math.min(sw.x, ne.x);
  const right = Math.max(sw.x, ne.x);
  const top = Math.min(sw.y, ne.y);
  const bottom = Math.max(sw.y, ne.y);
  const width = right - left;
  const height = bottom - top;
  if (width < 8 || height < 8) return null;
  return { left, top, width, height };
}

/** Handle del deslizador anclado al bbox del AOI (dentro del MapContainer). */
export default function SwipeControl() {
  const map = useMap();
  const { state, patch, drawing } = useMapApp();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  const aoi: BBox | null =
    state.result?.overlays?.bounds ??
    state.result?.aoi ??
    (state.selected[0] && state.selected[1] ? state.aoi : null);
  // Con o sin análisis: deslizador si hay par Antes/Después.
  const active = Boolean(
    state.slider && aoi && state.selected[0] && state.selected[1],
  );

  useEffect(() => {
    if (!active || !aoi) {
      setBox(null);
      return;
    }
    const update = () => setBox(aoiContainerBox(map, aoi));
    update();
    map.on("move zoom resize moveend zoomend", update);
    return () => {
      map.off("move zoom resize moveend zoomend", update);
    };
  }, [map, active, aoi]);

  /* Evitar que Leaflet panee el mapa al arrastrar el range. */
  useEffect(() => {
    const el = rootRef.current;
    if (!active || !el) return;

    DomEvent.disableClickPropagation(el);
    DomEvent.disableScrollPropagation(el);

    const lock = (e: Event) => {
      DomEvent.stopPropagation(e);
      map.dragging.disable();
    };
    const unlock = () => {
      if (!drawingRef.current) map.dragging.enable();
    };

    const startEvents = ["mousedown", "touchstart", "pointerdown"] as const;
    for (const ev of startEvents) {
      DomEvent.on(el, ev, lock);
    }
    window.addEventListener("mouseup", unlock);
    window.addEventListener("touchend", unlock);
    window.addEventListener("pointerup", unlock);
    window.addEventListener("blur", unlock);

    return () => {
      for (const ev of startEvents) {
        DomEvent.off(el, ev, lock);
      }
      window.removeEventListener("mouseup", unlock);
      window.removeEventListener("touchend", unlock);
      window.removeEventListener("pointerup", unlock);
      window.removeEventListener("blur", unlock);
      if (!drawingRef.current) map.dragging.enable();
    };
  }, [map, active, box]);

  if (!active || !box) return null;

  return createPortal(
    <div
      ref={rootRef}
      className="tune-swipe tune-swipe-aoi"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      }}
    >
      <div className="tune-swipe-line" style={{ left: `${state.split}%` }}>
        <span aria-hidden>↔</span>
      </div>
      <input
        type="range"
        aria-label="División temporal"
        min="0"
        max="100"
        value={state.split}
        onChange={(e) => patch({ split: +e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      />
      <div className="tune-swipe-label left">Antes</div>
      <div className="tune-swipe-label right">Después</div>
    </div>,
    map.getContainer(),
  );
}
