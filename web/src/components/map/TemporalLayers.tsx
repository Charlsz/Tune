import { ImageOverlay, Pane, Rectangle } from "react-leaflet";
import type { BBox } from "../../domain/aoi";
import { bboxToLatLngBounds } from "../../domain/aoi";
import type { Cell, Scene, State } from "../../domain/lab";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

export function Clip({ split, active }: { split: number; active: boolean }) {
  const map = useMap();
  useEffect(() => {
    const update = () => {
      const rect = map.getContainer().getBoundingClientRect();
      for (const name of ["before", "after"]) {
        const pane = map.getPane(name);
        if (!pane) continue;
        const origin = map.containerPointToLayerPoint([0, 0]);
        const left = name === "before" ? 0 : (rect.width * split) / 100;
        const right =
          name === "before" ? (rect.width * split) / 100 : rect.width;
        pane.style.clipPath = active
          ? `polygon(${origin.x + left}px ${origin.y}px,${origin.x + right}px ${origin.y}px,${origin.x + right}px ${origin.y + rect.height}px,${origin.x + left}px ${origin.y + rect.height}px)`
          : "none";
      }
    };
    update();
    map.on("move zoom resize", update);
    return () => {
      map.off("move zoom resize", update);
    };
  }, [map, split, active]);
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
  const overlayBounds = overlays
    ? bboxToLatLngBounds(overlays.bounds)
    : null;
  const showBefore = state.slider || state.mode === "before",
    showAfter = state.slider || state.mode !== "before";
  const useApiOverlays = Boolean(overlays);

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
            {showAfter && overlays?.afterPreview && (
              <ImageOverlay
                url={overlays.afterPreview}
                bounds={overlayBounds}
                opacity={1}
              />
            )}
            {state.result &&
              state.mask &&
              showAfter &&
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
            {after && showAfter && after.image && (
              <ImageOverlay
                url={after.image}
                bounds={bboxToLatLngBounds(after.bbox as BBox)}
              />
            )}
            {state.result &&
              state.mask &&
              showAfter &&
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
      {state.result &&
        state.mode === "change" &&
        !state.slider &&
        state.mask &&
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
            <Mask cells={state.result.cells} opacity={state.opacity} />
          </Pane>
        ))}
      <Clip split={state.split} active={state.slider} />
    </>
  );
}
