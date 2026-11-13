import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Rectangle,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { bboxFromPoint, bboxToLatLngBounds, clampSideKm } from "../../lib/aoi";
import type { Place } from "../../types";

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

type Props = {
  place: Place | null;
  draft: Place | null;
  sideKm: number;
  maxSideKm: number;
  disabled?: boolean;
  onDraft: (place: Place) => void;
  onSideKm?: (sideKm: number) => void;
};

function MapClickCapture({
  disabled,
  onDraft,
}: {
  disabled?: boolean;
  onDraft: (place: Place) => void;
}) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onDraft({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

function FlyToPlace({ place, sideKm }: { place: Place | null; sideKm: number }) {
  const map = useMap();
  useEffect(() => {
    if (!place) return;
    const bounds = bboxToLatLngBounds(bboxFromPoint(place.lat, place.lon, sideKm));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12, animate: false });
  }, [map, place?.lat, place?.lon, sideKm]);
  return null;
}

export function LocationMap({
  place,
  draft,
  sideKm,
  maxSideKm,
  disabled,
  onDraft,
  onSideKm,
}: Props) {
  const side = clampSideKm(sideKm, maxSideKm);
  const focus = draft ?? place;
  const center: [number, number] = focus ? [focus.lat, focus.lon] : DEFAULT_CENTER;

  const aoi = useMemo(() => {
    if (!focus) return null;
    return bboxToLatLngBounds(bboxFromPoint(focus.lat, focus.lon, side));
  }, [focus?.lat, focus?.lon, side]);

  const draftDiffers =
    draft != null &&
    (place == null || draft.lat !== place.lat || draft.lon !== place.lon);

  return (
    <div className={`tune-location-map${disabled ? " is-disabled" : ""}`}>
      <MapContainer
        center={center}
        zoom={focus ? 9 : DEFAULT_ZOOM}
        className="tune-location-map-canvas"
        scrollWheelZoom
        attributionControl
        keyboard={!disabled}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapClickCapture disabled={disabled} onDraft={onDraft} />
        <FlyToPlace place={focus} sideKm={side} />
        {aoi && (
          <Rectangle
            bounds={aoi}
            pathOptions={{
              color: "#111111",
              weight: draftDiffers ? 1.5 : 2,
              dashArray: draftDiffers ? "4 4" : undefined,
              fillColor: "#111111",
              fillOpacity: draftDiffers ? 0.04 : 0.08,
            }}
          />
        )}
        {place && <Marker position={[place.lat, place.lon]} icon={pinIcon("confirmed")} interactive={false} />}
        {draftDiffers && draft && (
          <Marker position={[draft.lat, draft.lon]} icon={pinIcon("draft")} interactive={false} />
        )}
      </MapContainer>

      <div className="tune-location-map-meta">
        <p className="caption">
          {disabled
            ? "Mapa en pausa mientras corre un análisis."
            : "Haz clic en el mapa para elegir el centro del recorte. Rueda o pellizco para acercar."}
        </p>
        {onSideKm && (
          <label className="field tune-map-side">
            Recorte (km)
            <input
              type="range"
              min={1}
              max={maxSideKm}
              step={1}
              value={side}
              disabled={disabled}
              aria-valuemin={1}
              aria-valuemax={maxSideKm}
              aria-valuenow={side}
              onChange={(e) => onSideKm(clampSideKm(Number(e.target.value), maxSideKm))}
            />
            <span className="num">{side} km</span>
            <span className="caption">máx. {maxSideKm}</span>
          </label>
        )}
      </div>
    </div>
  );
}
