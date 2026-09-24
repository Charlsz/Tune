import type { LatLngBoundsExpression } from "leaflet";
import { useEffect, useState } from "react";
import { ImageOverlay, MapContainer, Rectangle, ScaleControl, TileLayer, useMap } from "react-leaflet";
import { TASK_META } from "../lib/insights";
import type { Analysis } from "../types";

const WORLD: LatLngBoundsExpression = [
  [-55, -170],
  [70, 170],
];

const BASEMAPS = {
  map: {
    label: "Mapa",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, HERE, Garmin, OpenStreetMap",
    maxNativeZoom: 16,
  },
  sat: {
    label: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, Maxar, Earthstar Geographics",
    maxNativeZoom: 19,
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

function FitTo({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    const panel = window.innerWidth > 720 ? 400 : 0;
    map.flyToBounds(bounds, { paddingTopLeft: [panel + 48, 48], paddingBottomRight: [48, 48], duration: 1.1 });
  }, [map, bounds]);
  return null;
}

export function MapView({ analysis }: { analysis: Analysis | null }) {
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [showScene, setShowScene] = useState(true);
  const [opacity, setOpacity] = useState(0.85);

  const bounds = analysis ? toBounds(analysis) : null;
  const base = BASEMAPS[basemap];

  return (
    <main className="stage">
      <MapContainer bounds={WORLD} zoomControl={false} worldCopyJump style={{ height: "100%", width: "100%" }}>
        <TileLayer
          key={basemap}
          url={base.url}
          attribution={base.attribution}
          maxNativeZoom={base.maxNativeZoom}
          maxZoom={20}
        />
        <ScaleControl position="bottomright" imperial={false} />
        {analysis && bounds && (
          <>
            {showScene && analysis.artifacts.preview_png && (
              <ImageOverlay key={`${analysis.id}-rgb`} url={analysis.artifacts.preview_png} bounds={bounds} />
            )}
            <ImageOverlay
              key={`${analysis.id}-mask`}
              url={analysis.artifacts.mask_png}
              bounds={bounds}
              opacity={opacity}
              className={`mask-${analysis.task}`}
            />
            <Rectangle bounds={bounds} pathOptions={{ color: "#111", weight: 1, opacity: 0.5, fill: false }} />
            <FitTo bounds={bounds} />
          </>
        )}
      </MapContainer>

      <div className="controls">
        <div className="segmented small" data-index={basemap === "map" ? 0 : 1}>
          <span className="segmented-pill" aria-hidden />
          {(Object.keys(BASEMAPS) as Basemap[]).map((k) => (
            <button key={k} type="button" aria-pressed={basemap === k} onClick={() => setBasemap(k)}>
              {BASEMAPS[k].label}
            </button>
          ))}
        </div>
        {analysis && bounds && (
          <>
            <button type="button" className={`toggle ${showScene ? "on" : ""}`} onClick={() => setShowScene((v) => !v)}>
              Escena
            </button>
            <label className="opacity">
              <span className="muted">Máscara</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
              />
            </label>
          </>
        )}
      </div>

      {analysis && !bounds && <SceneViewer analysis={analysis} />}
    </main>
  );
}

function SceneViewer({ analysis: a }: { analysis: Analysis }) {
  const [split, setSplit] = useState(50);
  const rgb = a.artifacts.preview_png;
  return (
    <div className="viewer">
      <div className="card viewer-card">
        <div className="card-head">
          <span className="tag" style={{ "--accent": TASK_META[a.task].accent } as React.CSSProperties}>
            <i className="dot" />
            Escena sin georreferencia
          </span>
        </div>
        <p className="caption">
          {a.crs
            ? "Trae CRS, pero no se pudieron calcular sus límites. Se muestra en píxeles."
            : "El archivo no trae CRS. Se muestra en píxeles, no sobre el mapa."}
        </p>
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
        <div className="viewer-foot muted">
          <span>Escena</span>
          <span>Máscara</span>
        </div>
      </div>
    </div>
  );
}
