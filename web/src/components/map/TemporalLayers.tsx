import { useEffect } from "react";
import { ImageOverlay, Pane, Rectangle, useMap } from "react-leaflet";
import type { BBox } from "../../domain/aoi";
import { bboxToLatLngBounds } from "../../domain/aoi";
import type { Cell, Scene, State } from "../../domain/lab";

/** Clip de panes before/after al AOI (máscara) o al deslizador (swipe). */
export function Clip({
  split,
  active,
  aoi,
  mode = "swipe",
}: {
  split: number;
  active: boolean;
  aoi: BBox | null;
  /** mask = solo dentro del AOI; swipe = Antes|Después dentro del AOI */
  mode?: "swipe" | "mask";
}) {
  const map = useMap();
  useEffect(() => {
    const clear = () => {
      for (const name of ["before", "after"]) {
        const pane = map.getPane(name);
        if (pane) pane.style.clipPath = "none";
      }
    };

    const update = () => {
      if (!active || !aoi) {
        clear();
        return;
      }
      const [west, south, east, north] = aoi;
      const sw = map.latLngToLayerPoint([south, west]);
      const ne = map.latLngToLayerPoint([north, east]);
      const left = Math.min(sw.x, ne.x);
      const right = Math.max(sw.x, ne.x);
      const top = Math.min(sw.y, ne.y);
      const bottom = Math.max(sw.y, ne.y);
      if (right - left < 2 || bottom - top < 2) {
        clear();
        return;
      }
      const splitX = left + ((right - left) * split) / 100;

      for (const name of ["before", "after"] as const) {
        const pane = map.getPane(name);
        if (!pane) continue;
        if (mode === "mask") {
          pane.style.clipPath = `polygon(${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px)`;
          continue;
        }
        const x0 = name === "before" ? left : splitX;
        const x1 = name === "before" ? splitX : right;
        pane.style.clipPath = `polygon(${x0}px ${top}px, ${x1}px ${top}px, ${x1}px ${bottom}px, ${x0}px ${bottom}px)`;
      }
    };

    update();
    map.on("move zoom resize moveend zoomend", update);
    return () => {
      map.off("move zoom resize moveend zoomend", update);
      clear();
    };
  }, [map, split, active, aoi, mode]);
  return null;
}

const WATER_FILL = "#2563eb";
const FLOOD_FILL = "#e63946";

/** Evita PNG de máscara cacheados con el color antiguo (rojo). */
function maskUrl(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}v=water2`;
}

/** Overlay de selección: preview AOI del servidor; fallback footprint sin estirar thumb. */
function ScenePickOverlay({
  scene,
  show,
}: {
  scene: Scene;
  show: boolean;
}) {
  if (!show) return null;
  if (scene.previewStatus === "ready" && scene.mapPreviewUrl && scene.mapPreviewBounds) {
    return (
      <ImageOverlay
        url={scene.mapPreviewUrl}
        bounds={bboxToLatLngBounds(scene.mapPreviewBounds)}
        opacity={1}
      />
    );
  }
  // Loading: el AOI parpadea en MapView + chip; aquí no duplicamos borde.
  if (scene.previewStatus === "loading") return null;
  // Error / sin preview: outline del footprint (thumb queda en el panel).
  if (scene.bbox?.length >= 4) {
    return (
      <Rectangle
        bounds={bboxToLatLngBounds(scene.bbox as BBox)}
        pathOptions={{
          color: "#64748b",
          weight: 1.5,
          fillOpacity: 0,
          dashArray: "4 4",
        }}
        interactive={false}
      />
    );
  }
  return null;
}

function Mask({
  cells,
  opacity,
  fill = WATER_FILL,
}: {
  cells: Cell[];
  opacity: number;
  fill?: string;
}) {
  return (
    <>
      {cells.map((c, i) => (
        <Rectangle
          key={i}
          bounds={bboxToLatLngBounds(c.bbox)}
          pathOptions={{
            stroke: false,
            fillColor: fill,
            fillOpacity: opacity,
          }}
          interactive={false}
        />
      ))}
    </>
  );
}

export function TemporalLayers({
  state,
  waterCells,
}: {
  state: State;
  waterCells: (scene: Scene, aoi: BBox) => Cell[];
}) {
  const before = state.selected[0],
    after = state.selected[1];
  const overlays = state.result?.overlays;
  const useApiOverlays = Boolean(overlays);
  const swipeAoi: BBox | null =
    overlays?.bounds ?? state.result?.aoi ?? state.aoi ?? null;
  const overlayBounds = overlays
    ? bboxToLatLngBounds(overlays.bounds)
    : null;
  // Con resultado: modos + deslizador. Sin resultado: solo la escena enfocada (sustituye).
  const showBefore = useApiOverlays
    ? state.slider || state.mode === "before"
    : Boolean(before && state.mode === "before");
  const showAfterBase = useApiOverlays
    ? state.slider ||
      state.mode === "after" ||
      state.mode === "change" ||
      state.mode === "agree"
    : Boolean(after && (state.mode === "after" || state.mode === "change"));
  const showChange =
    state.result &&
    state.mode === "change" &&
    !state.slider &&
    state.mask;
  const showAgree =
    state.result &&
    state.mode === "agree" &&
    !state.slider &&
    state.mask &&
    overlays?.fusion;

  return (
    <>
      <Pane name="before" style={{ zIndex: 410 }}>
        {useApiOverlays && overlayBounds ? (
          <>
            {showBefore && overlays?.beforePreview && (
              <ImageOverlay
                url={overlays.beforePreview}
                bounds={overlayBounds}
                opacity={1}
              />
            )}
            {state.result &&
              state.mask &&
              showBefore &&
              (state.slider || state.mode === "before") &&
              overlays?.beforeMask && (
                <ImageOverlay
                  url={maskUrl(overlays.beforeMask)}
                  bounds={overlayBounds}
                  opacity={state.opacity}
                />
              )}
          </>
        ) : (
          <>
            {before && (
              <ScenePickOverlay scene={before} show={showBefore} />
            )}
            {state.result &&
              state.mask &&
              showBefore &&
              (state.slider || state.mode === "before") &&
              before && (
                <Mask
                  cells={waterCells(before, state.aoi)}
                  opacity={state.opacity}
                />
              )}
          </>
        )}
      </Pane>
      <Pane name="after" style={{ zIndex: 411 }}>
        {useApiOverlays && overlayBounds ? (
          <>
            {showAfterBase && overlays?.afterPreview && (
              <ImageOverlay
                url={overlays.afterPreview}
                bounds={overlayBounds}
                opacity={1}
              />
            )}
            {/* Deslizador: Después = inundación (change). Modo Después: agua detectada. */}
            {state.result &&
              state.mask &&
              state.slider &&
              overlays?.change && (
                <ImageOverlay
                  url={overlays.change}
                  bounds={overlayBounds}
                  opacity={state.opacity}
                />
              )}
            {state.result &&
              state.mask &&
              !state.slider &&
              state.mode === "after" &&
              overlays?.afterMask && (
                <ImageOverlay
                  url={maskUrl(overlays.afterMask)}
                  bounds={overlayBounds}
                  opacity={state.opacity}
                />
              )}
          </>
        ) : (
          <>
            {after && (
              <ScenePickOverlay scene={after} show={showAfterBase} />
            )}
            {state.result &&
              state.mask &&
              state.slider && (
                <Mask
                  cells={state.result.cells}
                  opacity={state.opacity}
                  fill={FLOOD_FILL}
                />
              )}
            {state.result &&
              state.mask &&
              !state.slider &&
              state.mode === "after" &&
              after && (
                <Mask
                  cells={waterCells(after, state.aoi)}
                  opacity={state.opacity}
                />
              )}
          </>
        )}
      </Pane>
      {showChange &&
        (useApiOverlays && overlayBounds && overlays?.change ? (
          <Pane name="change" style={{ zIndex: 420 }}>
            <ImageOverlay
              url={overlays.change}
              bounds={overlayBounds}
              opacity={state.opacity}
            />
          </Pane>
        ) : (
          <Pane name="change" style={{ zIndex: 420 }}>
            <Mask
              cells={state.result!.cells}
              opacity={state.opacity}
              fill={FLOOD_FILL}
            />
          </Pane>
        ))}
      {showAgree && overlayBounds && overlays?.fusion && (
        <Pane name="agree" style={{ zIndex: 421 }}>
          <ImageOverlay
            url={overlays.fusion}
            bounds={overlayBounds}
            opacity={state.opacity}
          />
        </Pane>
      )}
      <Clip
        split={state.split}
        active={
          Boolean(swipeAoi) &&
          (state.slider || (!useApiOverlays && (showBefore || showAfterBase)))
        }
        aoi={swipeAoi}
        mode={state.slider ? "swipe" : "mask"}
      />
    </>
  );
}
