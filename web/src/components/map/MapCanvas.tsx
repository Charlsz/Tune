import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Rectangle,
  TileLayer,
  useMap,
  useMapEvents,
  ImageOverlay,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  aoiPlace,
  bboxToLatLngBounds,
  normalizeBbox,
  type Aoi,
  type AoiMode,
  type BBox,
} from "../../lib/aoi";
import type { Analysis, Place } from "../../types";

const DEFAULT_CENTER: [number, number] = [4.71, -74.07];
const DEFAULT_ZOOM = 5;

const pinIcon = (kind: "confirmed" | "draft") =>
  L.divIcon({
    className: "tune-map-pin-icon",
    html: `<span class="tune-map-pin${kind === "draft" ? " is-draft" : ""}" role="img" aria-label="${
      kind === "draft" ? "Punto borrador" : "Punto confirmado"
    }"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

function CameraController({
  focusKey,
  bounds,
}: {
  focusKey: string | null;
  bounds: [[number, number], [number, number]] | null;
}) {
  const map = useMap();
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (!focusKey || !bounds) return;
    if (lastKey.current === focusKey) return;
    lastKey.current = focusKey;
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12, animate: false });
  }, [map, focusKey, bounds]);
  return null;
}

function PointCapture({
  enabled,
  onPoint,
}: {
  enabled: boolean;
  onPoint: (place: Place) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onPoint({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

function RectangleDraw({
  enabled,
  draft,
  onDraft,
  onCommit,
}: {
  enabled: boolean;
  draft: BBox | null;
  onDraft: (bbox: BBox | null) => void;
  onCommit: (bbox: BBox) => void;
}) {
  const map = useMap();
  const start = useRef<L.LatLng | null>(null);
  const drawing = useRef(false);
  const onDraftRef = useRef(onDraft);
  const onCommitRef = useRef(onCommit);
  onDraftRef.current = onDraft;
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (!enabled) {
      map.dragging.enable();
      map.boxZoom.enable();
      map.getContainer().style.cursor = "";
      drawing.current = false;
      start.current = null;
      return;
    }
    // Sin esto, Leaflet interpreta el arrastre como pan y el dibujo nunca arranca.
    map.dragging.disable();
    map.boxZoom.disable();
    map.getContainer().style.cursor = "crosshair";
    return () => {
      map.dragging.enable();
      map.boxZoom.enable();
      map.getContainer().style.cursor = "";
      drawing.current = false;
      start.current = null;
    };
  }, [map, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const finish = (latlng: L.LatLng) => {
      if (!drawing.current || !start.current) return;
      const origin = start.current;
      drawing.current = false;
      start.current = null;
      const raw: BBox = [origin.lng, origin.lat, latlng.lng, latlng.lat];
      const normalized = normalizeBbox(raw);
      onDraftRef.current(null);
      if (normalized) onCommitRef.current(normalized);
    };

    const onMove = (ev: MouseEvent) => {
      if (!drawing.current || !start.current) return;
      const latlng = map.mouseEventToLatLng(ev);
      onDraftRef.current([start.current.lng, start.current.lat, latlng.lng, latlng.lat]);
    };

    const onUp = (ev: MouseEvent) => {
      if (!drawing.current || !start.current) return;
      const latlng = map.mouseEventToLatLng(ev);
      finish(latlng);
    };

    // mouseup/move en document: si suelta fuera del mapa, igual cerramos el dibujo.
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [map, enabled]);

  useMapEvents({
    mousedown(e) {
      if (!enabled || e.originalEvent.button !== 0) return;
      L.DomEvent.preventDefault(e.originalEvent);
      L.DomEvent.stopPropagation(e.originalEvent);
      drawing.current = true;
      start.current = e.latlng;
      onDraftRef.current([e.latlng.lng, e.latlng.lat, e.latlng.lng, e.latlng.lat]);
    },
  });

  if (!draft) return null;
  const normalized = normalizeBbox(draft);
  if (!normalized) return null;
  return (
    <Rectangle
      bounds={bboxToLatLngBounds(normalized)}
      pathOptions={{ color: "#1a1a1a", weight: 1.5, dashArray: "4 4", fillOpacity: 0.06 }}
    />
  );
}

export type ResultLayerId = "change" | "mask" | "preview";

type Props = {
  mode: AoiMode;
  draftAoi: Aoi | null;
  confirmedAoi: Aoi | null;
  rectDraft: BBox | null;
  disabled?: boolean;
  result?: Analysis | null;
  resultLayer?: ResultLayerId;
  resultOpacity?: number;
  onPointDraft: (place: Place) => void;
  onRectDraft: (bbox: BBox | null) => void;
  onRectCommit: (bbox: BBox) => void;
  onFitRequestKey?: string | null;
};

export function MapCanvas({
  mode,
  draftAoi,
  confirmedAoi,
  rectDraft,
  disabled,
  result,
  resultLayer = "change",
  resultOpacity = 0.72,
  onPointDraft,
  onRectDraft,
  onRectCommit,
  onFitRequestKey,
}: Props) {
  const focus = draftAoi ?? confirmedAoi;
  const center: [number, number] = focus
    ? [aoiPlace(focus).lat, aoiPlace(focus).lon]
    : DEFAULT_CENTER;

  const aoiBounds = useMemo(() => {
    if (!focus) return null;
    return bboxToLatLngBounds(focus.bbox);
  }, [focus?.bbox[0], focus?.bbox[1], focus?.bbox[2], focus?.bbox[3]]);

  const cameraKey =
    onFitRequestKey ??
    (confirmedAoi
      ? `c:${confirmedAoi.bbox.join(",")}`
      : draftAoi
        ? `d:${aoiPlace(draftAoi).lat.toFixed(4)},${aoiPlace(draftAoi).lon.toFixed(4)}`
        : null);

  const resultUrl =
    result &&
    (resultLayer === "change"
      ? result.artifacts.change_png
      : resultLayer === "mask"
        ? result.artifacts.mask_png
        : result.artifacts.preview_png);

  const resultBounds =
    result?.bounds != null
      ? bboxToLatLngBounds([
          result.bounds.west,
          result.bounds.south,
          result.bounds.east,
          result.bounds.north,
        ])
      : null;

  return (
    <MapContainer
      className="map-first-leaflet"
      center={center}
      zoom={DEFAULT_ZOOM}
      minZoom={3}
      maxZoom={17}
      scrollWheelZoom
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CameraController focusKey={cameraKey} bounds={aoiBounds} />
      <PointCapture enabled={!disabled && mode === "point"} onPoint={onPointDraft} />
      <RectangleDraw
        enabled={!disabled && mode === "rectangle"}
        draft={rectDraft}
        onDraft={onRectDraft}
        onCommit={onRectCommit}
      />
      {focus && aoiBounds && (
        <Rectangle
          bounds={aoiBounds}
          pathOptions={{
            color: draftAoi && !confirmedAoi ? "#555" : "#111",
            weight: 2,
            dashArray: draftAoi && confirmedAoi !== draftAoi ? "5 4" : undefined,
            fillOpacity: 0.08,
          }}
        />
      )}
      {focus && mode === "point" && (
        <Marker
          position={[aoiPlace(focus).lat, aoiPlace(focus).lon]}
          icon={pinIcon(confirmedAoi ? "confirmed" : "draft")}
        />
      )}
      {resultUrl && resultBounds && (
        <ImageOverlay url={resultUrl} bounds={resultBounds} opacity={resultOpacity} zIndex={400} />
      )}
    </MapContainer>
  );
}
