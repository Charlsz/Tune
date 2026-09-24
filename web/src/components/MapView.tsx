import type { LatLngBoundsExpression } from "leaflet";
import { useEffect, useState } from "react";
import {
  ImageOverlay,
  MapContainer,
  Rectangle,
  ScaleControl,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { fmt, TASK_META } from "../lib/insights";
import type { Analysis } from "../types";

const WORLD: LatLngBoundsExpression = [
  [-60, -180],
  [75, 180],
];

const BASEMAPS = {
  sat: {
    label: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, Maxar, Earthstar Geographics",
  },
  dark: {
    label: "Oscuro",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
} as const;
type Basemap = keyof typeof BASEMAPS;

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
    if (bounds) map.flyToBounds(bounds, { padding: [60, 60], duration: 1.2 });
  }, [map, bounds]);
  return null;
}

function Cursor({ onMove }: { onMove: (p: { lat: number; lng: number } | null) => void }) {
  useMapEvents({
    mousemove: (e) => onMove(e.latlng),
    mouseout: () => onMove(null),
  });
  return null;
}

export function MapView({ analysis }: { analysis: Analysis | null }) {
  const [basemap, setBasemap] = useState<Basemap>("sat");
  const [showRgb, setShowRgb] = useState(true);
  const [showMask, setShowMask] = useState(true);
  const [opacity, setOpacity] = useState(0.8);
  const [cursor, setCursor] = useState<{ lat: number; lng: number } | null>(null);

  const bounds = analysis ? toBounds(analysis) : null;
  const base = BASEMAPS[basemap];
  const tint = analysis ? `mask-${analysis.task}` : "";

  return (
    <div className="stage">
      <MapContainer
        bounds={WORLD}
        zoomControl={false}
        attributionControl
        worldCopyJump
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer key={basemap} url={base.url} attribution={base.attribution} />
        <ScaleControl position="bottomright" imperial={false} />
        <Cursor onMove={setCursor} />
        {analysis && bounds && (
          <>
            {showRgb && analysis.artifacts.preview_png && (
              <ImageOverlay key={`${analysis.id}-rgb`} url={analysis.artifacts.preview_png} bounds={bounds} />
            )}
            {showMask && (
              <ImageOverlay
                key={`${analysis.id}-mask-${opacity}`}
                url={analysis.artifacts.mask_png}
                bounds={bounds}
                opacity={opacity}
                className={tint}
              />
            )}
            <Rectangle
              bounds={bounds}
              pathOptions={{ color: "#fff", weight: 1, opacity: 0.6, fill: false, dashArray: "4 4" }}
            />
            <FitTo bounds={bounds} />
          </>
        )}
      </MapContainer>

      <div className="hud-frame" aria-hidden>
        <i className="tl" />
        <i className="tr" />
        <i className="bl" />
        <i className="br" />
      </div>

      <div className="hud hud-tr">
        <div className="chips">
          {(Object.keys(BASEMAPS) as Basemap[]).map((k) => (
            <button key={k} type="button" className={basemap === k ? "on" : ""} onClick={() => setBasemap(k)}>
              {BASEMAPS[k].label}
            </button>
          ))}
        </div>
        {analysis && bounds && (
          <div className="layers">
            <label className="toggle">
              <input type="checkbox" checked={showRgb} onChange={(e) => setShowRgb(e.target.checked)} />
              <span>Escena RGB</span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={showMask} onChange={(e) => setShowMask(e.target.checked)} />
              <span>Máscara</span>
            </label>
            <label className="slider">
              <span>Opacidad</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
              />
              <span className="num">{Math.round(opacity * 100)}</span>
            </label>
          </div>
        )}
      </div>

      <div className="hud hud-bl num">
        {cursor
          ? `${fmt.coord(cursor.lat, "N", "S")}   ${fmt.coord(((cursor.lng + 540) % 360) - 180, "E", "W")}`
          : "Mueve el cursor sobre el mapa"}
      </div>

      {!analysis && (
        <div className="empty">
          <span className="eyebrow">Prithvi-EO 2.0 · IBM-NASA</span>
          <h2>Observa la Tierra, píxel a píxel.</h2>
          <p>Sube una escena Sentinel-2 o HLS y el modelo segmenta agua o área quemada en ventanas de 512×512.</p>
        </div>
      )}

      {analysis && !bounds && <SceneViewer analysis={analysis} />}
    </div>
  );
}

function SceneViewer({ analysis: a }: { analysis: Analysis }) {
  const [split, setSplit] = useState(50);
  const rgb = a.artifacts.preview_png;
  return (
    <div className="viewer">
      <div className="viewer-head">
        <span className="eyebrow">Vista de escena · sin georreferencia</span>
        <span className="hint">
          {a.crs
            ? "La escena trae CRS pero no se pudieron calcular sus límites: se muestra en píxeles."
            : "La escena no trae CRS: se muestra en píxeles, no sobre el mapa."}
        </span>
      </div>
      <div className="compare" style={{ "--split": `${split}%` } as React.CSSProperties}>
        {rgb && <img src={rgb} alt="Escena RGB" />}
        <img src={a.artifacts.mask_png} alt="Máscara" className={`compare-top mask-${a.task}`} />
        <div className="compare-handle" />
        <input
          aria-label="Comparar escena y máscara"
          type="range"
          min={0}
          max={100}
          value={split}
          onChange={(e) => setSplit(Number(e.target.value))}
        />
      </div>
      <div className="viewer-foot">
        <span>RGB</span>
        <span style={{ color: TASK_META[a.task].accent }}>Máscara · {TASK_META[a.task].name}</span>
      </div>
    </div>
  );
}
