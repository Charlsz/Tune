import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const { state, patch } = useMapApp();
  const [box, setBox] = useState<Box | null>(null);

  const aoi: BBox | null =
    state.result?.overlays?.bounds ?? state.result?.aoi ?? null;
  const active = Boolean(state.result && state.slider && aoi);

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

  if (!active || !box) return null;

  return createPortal(
    <div
      className="tune-swipe tune-swipe-aoi"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      }}
    >
      <div className="tune-swipe-line" style={{ left: `${state.split}%` }}>
        <span>↔</span>
      </div>
      <input
        type="range"
        aria-label="División temporal"
        min="0"
        max="100"
        value={state.split}
        onChange={(e) => patch({ split: +e.target.value })}
      />
      <div className="tune-swipe-label left">Antes</div>
      <div className="tune-swipe-label right">Después</div>
    </div>,
    map.getContainer(),
  );
}
