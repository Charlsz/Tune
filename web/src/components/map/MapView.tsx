import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MapContainer,
  TileLayer,
  Rectangle,
  Pane,
  ScaleControl,
  ZoomControl,
  useMap,
} from "react-leaflet";
import type { LatLng, Rectangle as LeafletRectangle } from "leaflet";
import "leaflet/dist/leaflet.css";
import { bboxToLatLngBounds, type BBox } from "../../domain/aoi";
import { resolveDrawMouseUp } from "../../domain/mapAreaGesture";
import type { State, Scene, Cell } from "../../domain/lab";
import SwipeControl from "./SwipeControl";
import { TemporalLayers } from "./TemporalLayers";

/** Contorno del AOI; con `pulsing` anima fill/stroke vía setStyle (CSS no gana a Leaflet). */
function AoiOutline({
  aoi,
  pulsing,
  slow = false,
}: {
  aoi: BBox;
  pulsing: boolean;
  slow?: boolean;
}) {
  const [layer, setLayer] = useState<LeafletRectangle | null>(null);

  useEffect(() => {
    if (!layer) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!pulsing) {
      layer.setStyle({
        fillOpacity: 0,
        opacity: 1,
        weight: 1.5,
      });
      return;
    }

    if (reduced) {
      layer.setStyle({
        fillOpacity: slow ? 0.08 : 0.14,
        opacity: 0.85,
        weight: 2,
      });
      return;
    }

    const period = slow ? 2400 : 1150;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = ((now - start) % period) / period;
      const wave = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
      layer.setStyle({
        fillOpacity: slow ? 0.03 + wave * 0.1 : 0.05 + wave * 0.26,
        opacity: slow ? 0.35 + wave * 0.4 : 0.35 + wave * 0.65,
        weight: 2,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [layer, pulsing, slow, aoi]);

  return (
    <Rectangle
      ref={setLayer}
      bounds={bboxToLatLngBounds(aoi)}
      interactive={false}
      pathOptions={{
        color: "#111111",
        weight: pulsing ? 2 : 1.5,
        dashArray: "5 4",
        fill: true,
        fillColor: "#111111",
        fillOpacity: pulsing ? 0.14 : 0,
        opacity: 1,
      }}
    />
  );
}

/** MapContainer congela className al montar; la clase de dibujo hay que togglearla. */
function DrawingCursor({ drawing }: { drawing: boolean }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    el.classList.toggle("drawing-map", drawing);
    return () => el.classList.remove("drawing-map");
  }, [map, drawing]);
  return null;
}

function Controls({
  state,
  drawing,
  onArea,
  onError,
  maxSideKm,
}: {
  state: State;
  drawing: boolean;
  onArea: (b: BBox, l: string) => void;
  onError: (s: string) => void;
  maxSideKm: number;
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
    // Preview de catálogo se ancla al AOI: siempre encuadrar el cuadrado de interés.
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
      const result = resolveDrawMouseUp(from, end, maxSideKm);
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
  }, [drawing, map, maxSideKm]);

  return draft ? (
    <Rectangle
      pane="selection"
      interactive={false}
      bounds={bboxToLatLngBounds(draft)}
      pathOptions={{ color: "#111111", weight: 1, fillOpacity: 0.05 }}
    />
  ) : null;
}

/** Raya que recorre el AOI mientras corre el análisis. No captura el ratón. */
function AoiScan({ active, aoi }: { active: boolean; aoi: BBox }) {
  const map = useMap();
  const [box, setBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!active) {
      setBox(null);
      return;
    }
    const update = () => {
      if ((map as { _animatingZoom?: boolean })._animatingZoom) return;
      const [west, south, east, north] = aoi;
      const sw = map.latLngToContainerPoint([south, west]);
      const ne = map.latLngToContainerPoint([north, east]);
      const left = Math.min(sw.x, ne.x);
      const top = Math.min(sw.y, ne.y);
      const width = Math.abs(ne.x - sw.x);
      const height = Math.abs(ne.y - sw.y);
      if (width < 8 || height < 8) {
        setBox(null);
        return;
      }
      setBox({ left, top, width, height });
    };
    update();
    map.on("move", update);
    map.on("moveend zoomend resize", update);
    return () => {
      map.off("move", update);
      map.off("moveend zoomend resize", update);
    };
  }, [map, active, aoi]);

  if (!active || !box) return null;

  return createPortal(
    <div
      className="tune-aoi-scan"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      }}
      aria-hidden
    >
      <div className="tune-aoi-scan-wash" />
      <div className="tune-aoi-scan-line" />
    </div>,
    map.getContainer(),
  );
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
  maxSideKm = 30,
}: {
  state: State;
  drawing: boolean;
  onArea: (b: BBox, l: string) => void;
  onError: (s: string) => void;
  waterCells: (s: Scene, a: BBox) => Cell[];
  maxSideKm?: number;
}) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  const tileUrl = token
    ? mapboxTileUrl(token)
    : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = token
    ? '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const previewLoading = state.selected.some(
    (s) => s?.previewStatus === "loading",
  );
  const analyzing = state.step === "running";

  return (
    <MapContainer
      center={[27.1, 67.95]}
      zoom={9}
      zoomControl={false}
      maxZoom={token ? 22 : 19}
    >
      <DrawingCursor drawing={drawing} />
      <TileLayer
        url={tileUrl}
        attribution={attribution}
        {...(token ? { tileSize: 512, zoomOffset: -1, maxZoom: 22 } : {})}
      />
      <TemporalLayers
        state={state}
        waterCells={waterCells}
        drawing={drawing}
      />
      <SwipeControl />
      <Pane
        name="selection"
        style={{ zIndex: 450, pointerEvents: drawing ? "none" : "auto" }}
      >
        <AoiOutline
          aoi={state.aoi}
          pulsing={previewLoading || analyzing}
          slow={analyzing}
        />
        <AoiScan active={analyzing} aoi={state.aoi} />
      </Pane>
      <Controls
        state={state}
        drawing={drawing}
        onArea={onArea}
        onError={onError}
        maxSideKm={maxSideKm}
      />
      <ZoomControl position="bottomright" />
      <ScaleControl position="bottomright" imperial={false} />
    </MapContainer>
  );
}
