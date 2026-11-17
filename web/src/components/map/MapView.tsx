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
import {
  aoiFromPoint,
  bboxToLatLngBounds,
  validateAoiBbox,
  type BBox,
} from "../../domain/aoi";
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
  const map = useMap(),
    start = useRef<LatLng | null>(null),
    [draft, setDraft] = useState<BBox | null>(null);
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
    start.current = null;
    setDraft(null);
    if (drawing) map.dragging.disable();
    else map.dragging.enable();
    return () => {
      map.dragging.enable();
    };
  }, [map, drawing]);
  useMapEvents({
    mousedown(e) {
      if (drawing) start.current = e.latlng;
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
      const b: BBox = [
        start.current.lng,
        start.current.lat,
        e.latlng.lng,
        e.latlng.lat,
      ];
      start.current = null;
      setDraft(null);
      const valid = validateAoiBbox(b, 150);
      if (valid.ok) onArea(valid.bbox, "Área dibujada");
      else onError(valid.error);
    },
    click(e) {
      if (!drawing && state.step === "area")
        onArea(
          aoiFromPoint({ lat: e.latlng.lat, lon: e.latlng.lng }, 35, 150).bbox,
          "Punto seleccionado",
        );
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
