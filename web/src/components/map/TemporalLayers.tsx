import { useEffect, useRef } from "react";
import { ImageOverlay, Pane, Rectangle, useMap } from "react-leaflet";
import type { ImageOverlay as LeafletImage } from "leaflet";
import type { BBox } from "../../domain/aoi";
import { bboxToLatLngBounds, imageClip } from "../../domain/aoi";
import type { Cell, Scene, State } from "../../domain/lab";

/** Quita un clip en píxeles que un zoom anterior haya dejado en el pane. */
function ClearPaneClip() {
  const map = useMap();
  useEffect(() => {
    for (const name of ["before", "after", "change", "agree"]) {
      const pane = map.getPane(name);
      if (pane) pane.style.clipPath = "";
    }
  }, [map]);
  return null;
}

function ClippedImage({
  url,
  bounds,
  opacity,
  clip,
}: {
  url: string;
  bounds: BBox;
  opacity: number;
  clip: string;
}) {
  const layerRef = useRef<LeafletImage | null>(null);
  const clipRef = useRef(clip);
  clipRef.current = clip;

  const apply = (layer: LeafletImage | null) => {
    const el = layer?.getElement();
    if (el) el.style.clipPath = clipRef.current;
  };

  useEffect(() => {
    apply(layerRef.current);
  }, [clip, url]);

  return (
    <ImageOverlay
      ref={(layer) => {
        layerRef.current = layer;
        apply(layer);
      }}
      url={url}
      bounds={bboxToLatLngBounds(bounds)}
      opacity={opacity}
    />
  );
}

const WATER_FILL = "#2563eb";
const FLOOD_FILL = "#e63946";

/** Evita PNG de máscara cacheados con el color antiguo (rojo). */
function maskUrl(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}v=water2`;
}

/** Base satelital: STAC del preview elegido si existe; si no, artefactos del análisis. */
function satelliteBase(
  scene: Scene | null | undefined,
  fallbackUrl: string | undefined,
  fallbackBounds: BBox | null,
): { url: string; bounds: BBox } | null {
  if (
    scene?.previewStatus === "ready" &&
    scene.mapPreviewUrl &&
    scene.mapPreviewBounds
  ) {
    return { url: scene.mapPreviewUrl, bounds: scene.mapPreviewBounds };
  }
  if (fallbackUrl && fallbackBounds) {
    return { url: fallbackUrl, bounds: fallbackBounds };
  }
  return null;
}

/** Overlay de selección: preview AOI del servidor; fallback footprint sin estirar thumb. */
function ScenePickOverlay({
  scene,
  show,
  clip,
}: {
  scene: Scene;
  show: boolean;
  clip: string;
}) {
  if (!show) return null;
  if (scene.previewStatus === "ready" && scene.mapPreviewUrl && scene.mapPreviewBounds) {
    return (
      <ClippedImage
        url={scene.mapPreviewUrl}
        bounds={scene.mapPreviewBounds}
        opacity={1}
        clip={clip}
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
  drawing = false,
}: {
  state: State;
  waterCells: (scene: Scene, aoi: BBox) => Cell[];
  /** Mientras se traza un AOI nuevo, la imagen anterior no debe tapar el gesto. */
  drawing?: boolean;
}) {
  if (drawing) return null;

  const before = state.selected[0],
    after = state.selected[1];
  const overlays = state.result?.overlays;
  const useApiOverlays = Boolean(overlays);
  const swipeAoi: BBox | null =
    overlays?.bounds ?? state.result?.aoi ?? state.aoi ?? null;
  const overlayBox = overlays?.bounds ?? null;
  const clipFor = (image: BBox, side: "before" | "after" | "full") =>
    imageClip(
      image,
      swipeAoi ?? image,
      state.slider && side !== "full" ? "swipe" : "mask",
      state.split,
      side,
    );
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
  const beforeBase = useApiOverlays
    ? satelliteBase(before, overlays?.beforePreview, overlayBox)
    : null;
  const afterBase = useApiOverlays
    ? satelliteBase(after, overlays?.afterPreview, overlayBox)
    : null;

  return (
    <>
      <Pane name="before" style={{ zIndex: 410 }}>
        {useApiOverlays && overlayBox ? (
          <>
            {showBefore && beforeBase && (
              <ClippedImage
                url={beforeBase.url}
                bounds={beforeBase.bounds}
                opacity={1}
                clip={clipFor(beforeBase.bounds, "before")}
              />
            )}
            {state.result &&
              state.mask &&
              showBefore &&
              (state.slider || state.mode === "before") &&
              overlays?.beforeMask &&
              overlayBox && (
                <ClippedImage
                  url={maskUrl(overlays.beforeMask)}
                  bounds={overlayBox}
                  opacity={state.opacity}
                  clip={clipFor(overlayBox, "before")}
                />
              )}
          </>
        ) : (
          <>
            {before && (
              <ScenePickOverlay
                scene={before}
                show={showBefore}
                clip={
                  before.mapPreviewBounds
                    ? clipFor(before.mapPreviewBounds, "before")
                    : "none"
                }
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
        {useApiOverlays && overlayBox ? (
          <>
            {showAfterBase && afterBase && (
              <ClippedImage
                url={afterBase.url}
                bounds={afterBase.bounds}
                opacity={1}
                clip={clipFor(afterBase.bounds, "after")}
              />
            )}
            {/* Deslizador: Después = inundación (change). Modo Después: agua detectada. */}
            {state.result &&
              state.mask &&
              state.slider &&
              overlays?.change &&
              overlayBox && (
                <ClippedImage
                  url={overlays.change}
                  bounds={overlayBox}
                  opacity={state.opacity}
                  clip={clipFor(overlayBox, "after")}
                />
              )}
            {state.result &&
              state.mask &&
              !state.slider &&
              state.mode === "after" &&
              overlays?.afterMask &&
              overlayBox && (
                <ClippedImage
                  url={maskUrl(overlays.afterMask)}
                  bounds={overlayBox}
                  opacity={state.opacity}
                  clip={clipFor(overlayBox, "after")}
                />
              )}
          </>
        ) : (
          <>
            {after && (
              <ScenePickOverlay
                scene={after}
                show={showAfterBase}
                clip={
                  after.mapPreviewBounds
                    ? clipFor(after.mapPreviewBounds, "after")
                    : "none"
                }
              />
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
        (useApiOverlays && overlayBox && overlays?.change ? (
          <Pane name="change" style={{ zIndex: 420 }}>
            <ClippedImage
              url={overlays.change}
              bounds={overlayBox}
              opacity={state.opacity}
              clip={clipFor(overlayBox, "full")}
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
      {showAgree && overlayBox && overlays?.fusion && (
        <Pane name="agree" style={{ zIndex: 421 }}>
          <ClippedImage
            url={overlays.fusion}
            bounds={overlayBox}
            opacity={state.opacity}
            clip={clipFor(overlayBox, "full")}
          />
        </Pane>
      )}
      <ClearPaneClip />
    </>
  );
}
