import { useEffect } from "react";
import { ImageOverlay, Pane, Rectangle, useMap } from "react-leaflet";
import type { BBox } from "../../domain/aoi";
import { bboxToLatLngBounds } from "../../domain/aoi";
import type { Cell, Scene, State } from "../../domain/lab";

/** Clip del swipe limitado al rectángulo del AOI en píxeles de capa. */
export function Clip({
  split,
  active,
  aoi,
}: {
  split: number;
  active: boolean;
  aoi: BBox | null;
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
  }, [map, split, active, aoi]);
  return null;
}

function Mask({ cells, opacity }: { cells: Cell[]; opacity: number }) {
  return (
    <>
      {cells.map((c, i) => (
        <Rectangle
          key={i}
          bounds={bboxToLatLngBounds(c.bbox)}
          pathOptions={{
            stroke: false,
            fillColor: "#2563eb",
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
  const swipeAoi: BBox | null =
    overlays?.bounds ?? state.result?.aoi ?? null;
  const overlayBounds = overlays
    ? bboxToLatLngBounds(overlays.bounds)
    : null;
  const showBefore = state.slider || state.mode === "before";
  const showAfterBase =
    state.slider ||
    state.mode === "after" ||
    state.mode === "change" ||
    state.mode === "agree";
  const useApiOverlays = Boolean(overlays);
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
                  url={overlays.beforeMask}
                  bounds={overlayBounds}
                  opacity={state.opacity}
                />
              )}
          </>
        ) : (
          <>
            {before && showBefore && before.image && (
              <ImageOverlay
                url={before.image}
                bounds={bboxToLatLngBounds(before.bbox as BBox)}
              />
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
            {state.result &&
              state.mask &&
              (state.slider || state.mode === "after") &&
              overlays?.afterMask && (
                <ImageOverlay
                  url={overlays.afterMask}
                  bounds={overlayBounds}
                  opacity={state.opacity}
                />
              )}
          </>
        ) : (
          <>
            {after && showAfterBase && after.image && (
              <ImageOverlay
                url={after.image}
                bounds={bboxToLatLngBounds(after.bbox as BBox)}
              />
            )}
            {state.result &&
              state.mask &&
              (state.slider || state.mode === "after") &&
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
            <Mask cells={state.result!.cells} opacity={state.opacity} />
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
      <Clip split={state.split} active={state.slider} aoi={swipeAoi} />
    </>
  );
}
