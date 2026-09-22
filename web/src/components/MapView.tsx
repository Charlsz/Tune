import type { LatLngBoundsExpression } from "leaflet";
import { useEffect } from "react";
import { ImageOverlay, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Analysis } from "../types";

const WORLD: LatLngBoundsExpression = [
  [-60, -180],
  [75, 180],
];

function toBounds(a: Analysis): LatLngBoundsExpression | null {
  if (!a.bounds) return null;
  return [
    [a.bounds.south, a.bounds.west],
    [a.bounds.north, a.bounds.east],
  ];
}

function FitTo({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, bounds]);
  return null;
}

export function MapView({ analysis }: { analysis: Analysis | null }) {
  const bounds = analysis ? toBounds(analysis) : null;
  return (
    <MapContainer bounds={WORLD} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {analysis && bounds && (
        <>
          {analysis.artifacts.preview_png && (
            <ImageOverlay
              key={`${analysis.id}-rgb`}
              url={analysis.artifacts.preview_png}
              bounds={bounds}
              opacity={0.9}
            />
          )}
          <ImageOverlay
            key={`${analysis.id}-mask`}
            url={analysis.artifacts.mask_png}
            bounds={bounds}
          />
          <FitTo bounds={bounds} />
        </>
      )}
      {analysis && !bounds && (
        <div className="map-notice">La imagen no tiene georreferencia; no se puede ubicar.</div>
      )}
    </MapContainer>
  );
}
