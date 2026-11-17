import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Rectangle,
  Pane,
  ScaleControl,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LatLng } from "leaflet";
import "leaflet/dist/leaflet.css";
import { bboxToLatLngBounds, type BBox } from "../../domain/aoi";
import {
  canSelectPointOnClick,
  pointSelectBbox,
  resolveDrawMouseUp,
} from "../../domain/mapAreaGesture";
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
  const drawingRef = useRef(drawing);
  const stepRef = useRef(state.step);
  /** Evita que el click tras mouseup pise un dibujo (H2). */
  const suppressPointClick = useRef(false);
  const [draft, setDraft] = useState<BBox | null>(null);
  drawingRef.current = drawing;
  stepRef.current = state.step;

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
    map.fitBounds(bboxToLatLngBounds(state.aoi), {
      paddingTopLeft:
        state.variant === "floating" && map.getContainer().clientWidth > 640
          ? [430, 100]
          : [35, 100],
      paddingBottomRight: [70, 120],
      animate: false,
    });
  }, [map, state.aoi, state.variant]);
  useEffect(() => {
    // Búsqueda / commit nuevo: quitar draft de un rechazo anterior.
    setDraft(null);
  }, [state.aoi]);
  useEffect(() => {
    start.current = null;
    setDraft(null);
    suppressPointClick.current = false;
    if (drawing) map.dragging.disable();
    else map.dragging.enable();
    return () => {
      map.dragging.enable();
    };
  }, [map, drawing]);
  useMapEvents({
    mousedown(e) {
      if (!drawingRef.current) return;
      start.current = e.latlng;
      setDraft(null);
    },
    mousemove(e) {
      if (start.current)
        setDraft([
          start.current.lng,
          start.current.lat,
          e.latlng.lng,
          e.latlng.lat,
        ]);
    },
    mouseup(e) {
      if (!start.current) return;
      // Siempre consumir el click que Leaflet emite después del mouseup.
      suppressPointClick.current = true;
      const from = start.current;
      start.current = null;
      const result = resolveDrawMouseUp(from, e.latlng);
      if (result.kind === "commit") {
        setDraft(null);
        onArea(result.bbox, result.label);
      } else {
        // H1: no tocar state.aoi; dejar draft visible si es normalizable.
        setDraft(result.draft);
        onError(result.error);
      }
    },
    click(e) {
      if (
        !canSelectPointOnClick({
          drawing: drawingRef.current,
          step: stepRef.current,
          suppressPointClick: suppressPointClick.current,
        })
      ) {
        suppressPointClick.current = false;
        return;
      }
      onArea(pointSelectBbox(e.latlng.lat, e.latlng.lng), "Punto seleccionado");
    },
  });
  return draft ? (
    <Rectangle
      pane="selection"
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
      <Pane name="selection" style={{ zIndex: 450 }}>
        <Rectangle
          bounds={bboxToLatLngBounds(state.aoi)}
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
