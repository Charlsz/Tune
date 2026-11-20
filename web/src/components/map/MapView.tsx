import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Rectangle,
  Pane,
  ScaleControl,
  ZoomControl,
  useMap,
} from "react-leaflet";
import type { LatLng } from "leaflet";
import "leaflet/dist/leaflet.css";
import { bboxToLatLngBounds, type BBox } from "../../domain/aoi";
import { resolveDrawMouseUp } from "../../domain/mapAreaGesture";
import type { State, Scene, Cell } from "../../domain/lab";
import SwipeControl from "./SwipeControl";
import { TemporalLayers } from "./TemporalLayers";

function Controls({
  state,
  drawing,
  onArea,
  onError,
}: {
  state: State;
  drawing: boolean;
  onArea: (b: BBox, l: string) => void;
  onError: (s: string) => void;
}) {
  const map = useMap();
  const start = useRef<LatLng | null>(null);
  const [draft, setDraft] = useState<BBox | null>(null);
  // Mantener callbacks estables para no re-registrar listeners a mitad del gesto.
  const onAreaRef = useRef(onArea);
  const onErrorRef = useRef(onError);
  onAreaRef.current = onArea;
  onErrorRef.current = onError;

  useEffect(() => {
    const update = () => map.invalidateSize({ pan: false });
    const timer = setTimeout(update, 30);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(map.getContainer());
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [map, state.variant]);
  useEffect(() => {
    map.invalidateSize({ pan: false });
    const before = state.selected[0];
    const after = state.selected[1];
    // Sin análisis: encuadrar la escena enfocada; con ambas + slider, el AOI.
    let focus = state.aoi;
    if (!state.result) {
      if (state.slider && before && after) {
        focus = state.aoi;
      } else if (state.mode === "before" && before?.bbox) {
        focus = before.bbox as BBox;
      } else if (after?.bbox) {
        focus = after.bbox as BBox;
      } else if (before?.bbox) {
        focus = before.bbox as BBox;
      }
    }
    map.fitBounds(bboxToLatLngBounds(focus), {
      paddingTopLeft:
        state.variant === "floating" && map.getContainer().clientWidth > 640
          ? [430, 100]
          : [35, 100],
      paddingBottomRight: [70, 120],
      animate: false,
    });
  }, [
    map,
    state.aoi,
    state.variant,
    state.result,
    state.selected,
    state.mode,
    state.slider,
  ]);
  useEffect(() => {
    setDraft(null);
  }, [state.aoi]);
  useEffect(() => {
    start.current = null;
    setDraft(null);
    if (drawing) map.dragging.disable();
    else map.dragging.enable();
    return () => {
      map.dragging.enable();
    };
  }, [map, drawing]);

  // Solo rectángulo dibujado = AOI exacto. Sin click→punto 35 km (pisaba el trazo).
  useEffect(() => {
    if (!drawing) return;
    const container = map.getContainer();

    const finish = (ev: MouseEvent) => {
      if (!start.current) return;
      const from = start.current;
      start.current = null;
      const end = map.mouseEventToLatLng(ev);
      const result = resolveDrawMouseUp(from, end);
      if (result.kind === "commit") {
        setDraft(null);
        onAreaRef.current(result.bbox, result.label);
      } else {
        setDraft(result.draft);
        onErrorRef.current(result.error);
      }
    };

    const onDown = (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      // Evitar que el mapa u otros handlers interpreten el gesto.
      ev.preventDefault();
      start.current = map.mouseEventToLatLng(ev);
      setDraft(null);
    };
    const onMove = (ev: MouseEvent) => {
      if (!start.current) return;
      const ll = map.mouseEventToLatLng(ev);
      setDraft([start.current.lng, start.current.lat, ll.lng, ll.lat]);
    };
    const onUp = (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      finish(ev);
    };

    container.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      container.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drawing, map]);

  return draft ? (
    <Rectangle
      pane="selection"
      interactive={false}
      bounds={bboxToLatLngBounds(draft)}
      pathOptions={{ color: "#111111", weight: 1, fillOpacity: 0.05 }}
    />
  ) : null;
}

function mapboxTileUrl(token: string) {
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${token}`;
}

export default function MapView({
  state,
  drawing,
  onArea,
  onError,
  waterCells,
}: {
  state: State;
  drawing: boolean;
  onArea: (b: BBox, l: string) => void;
  onError: (s: string) => void;
  waterCells: (s: Scene, a: BBox) => Cell[];
}) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  const tileUrl = token
    ? mapboxTileUrl(token)
    : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = token
    ? '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  return (
    <MapContainer
      center={[27.1, 67.95]}
      zoom={9}
      zoomControl={false}
      maxZoom={token ? 22 : 19}
      className={drawing ? "drawing-map" : ""}
    >
      <TileLayer
        url={tileUrl}
        attribution={attribution}
        {...(token ? { tileSize: 512, zoomOffset: -1, maxZoom: 22 } : {})}
      />
      <TemporalLayers state={state} waterCells={waterCells} />
      <SwipeControl />
      <Pane
        name="selection"
        style={{ zIndex: 450, pointerEvents: drawing ? "none" : "auto" }}
      >
        <Rectangle
          bounds={bboxToLatLngBounds(state.aoi)}
          interactive={false}
          pathOptions={{
            color: "#111111",
            weight: 1.5,
            dashArray: "5 4",
            fill: false,
          }}
        />
      </Pane>
      <Controls
        state={state}
        drawing={drawing}
        onArea={onArea}
        onError={onError}
      />
      <ZoomControl position="bottomright" />
      <ScaleControl position="bottomright" imperial={false} />
    </MapContainer>
  );
}
