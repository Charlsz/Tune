import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import { catalogQueryFromAoi, uploadsToResult } from "../data/apiBridge";
import {
  initialState,
  reducer,
  type AnalyzeProgressEvent,
  type DataProvider,
  type Scene,
  type State,
} from "../domain/lab";
import { tuneProvider } from "../data/tuneProvider";
import type { BBox } from "../domain/aoi";
import type { AnalyzePhase } from "../api/client";
import type { CatalogLimits } from "../types";

type ViewPatch = Partial<
  Pick<
    State,
    "page" | "mode" | "mask" | "opacity" | "slider" | "split" | "variant"
  >
>;

export type MapAppContextValue = {
  state: State;
  provider: DataProvider;
  query: string;
  setQuery: (q: string) => void;
  drawing: boolean;
  setDrawing: (v: boolean) => void;
  error: string;
  setError: (e: string) => void;
  catalog: [Scene[], Scene[]];
  loading: boolean;
  setLoading: (v: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  fullscreen: boolean;
  analyzeProgress: AnalyzeProgressEvent | null;
  /** Tope de nubes del recorte (0–90). Lo usan la búsqueda y el análisis. */
  maxCloud: number;
  setMaxCloud: (n: number) => void;
  /** Lado máximo del catálogo, en km. */
  maxSideKm: number;
  patch: (p: ViewPatch) => void;
  setArea: (bbox: BBox, label: string) => void;
  findScenes: () => Promise<void>;
  analyze: () => Promise<boolean>;
  /** GeoTIFF: uno, o Antes y luego Después. */
  analyzeUploads: (before: File, after: File | null) => Promise<boolean>;
  /** Reabre un análisis del historial de sesión como activo. */
  restoreAnalysis: (id: string) => boolean;
  /** Elige escena Antes/Después y pide preview AOI al servidor. */
  selectScene: (index: 0 | 1, scene: Scene) => void;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
  bumpTokens: () => void;
  toggleFullscreen: () => Promise<void>;
};

const MapAppContext = createContext<MapAppContextValue | null>(null);

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

export function MapAppProvider({
  children,
  provider = tuneProvider,
}: {
  children: ReactNode;
  provider?: DataProvider;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [query, setQuery] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState<[Scene[], Scene[]]>([[], []]);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] =
    useState<AnalyzeProgressEvent | null>(null);
  const [maxCloud, setMaxCloudState] = useState(40);
  const [maxSideKm, setMaxSideKm] = useState(30);
  const request = useRef(0);
  const analysis = useRef(0);
  const previewReq = useRef(0);
  const maxSideKmRef = useRef(maxSideKm);
  maxSideKmRef.current = maxSideKm;

  const patch = useCallback((p: ViewPatch) => {
    dispatch({ type: "view", patch: p });
  }, []);

  const setMaxCloud = useCallback((n: number) => {
    if (!Number.isFinite(n)) return;
    setMaxCloudState(Math.min(90, Math.max(0, Math.round(n))));
  }, []);

  const bumpTokens = useCallback(() => {
    analysis.current++;
    request.current++;
  }, []);

  const setArea = useCallback(
    (bbox: BBox, label: string) => {
      bumpTokens();
      previewReq.current++;
      dispatch({ type: "area", bbox, label });
      setDrawing(false);
      setLoading(false);
      setSearchOpen(false);
      setPanelOpen(true);
      setError("");
      setCatalog([[], []]);
      setAnalyzeProgress(null);
    },
    [bumpTokens],
  );

  const findScenes = useCallback(async () => {
    const token = ++request.current;
    setLoading(true);
    setError("");
    try {
      const scenes = await Promise.all(
        state.dates.map((d) => provider.scenes(state.aoi, d, maxCloud)),
      );
      if (token === request.current) {
        setCatalog(scenes as [Scene[], Scene[]]);
        dispatch({ type: "step", step: "scenes" });
      }
    } catch (err) {
      if (token === request.current) {
        setError(errorMessage(err, "No se pudieron consultar las imágenes."));
      }
    } finally {
      if (token === request.current) setLoading(false);
    }
  }, [provider, state.aoi, state.dates, maxCloud]);

  const analyze = useCallback(async () => {
    if (!state.selected[0] || !state.selected[1]) return false;
    const token = ++analysis.current;
    dispatch({ type: "step", step: "running" });
    setError("");
    setAnalyzeProgress({ scene: "before", phase: "prepare" });
    try {
      const result = await provider.analyze(
        state.aoi,
        state.selected[0],
        state.selected[1],
        (e) => {
          if (token === analysis.current) setAnalyzeProgress(e);
        },
        maxCloud,
      );
      if (token === analysis.current) {
        setAnalyzeProgress(null);
        dispatch({ type: "result", result });
        return true;
      }
      return false;
    } catch (err) {
      if (token === analysis.current) {
        setAnalyzeProgress(null);
        setError(errorMessage(err, "No se pudo completar el análisis."));
        dispatch({ type: "step", step: "ready" });
      }
      return false;
    }
  }, [provider, state.aoi, state.selected, maxCloud]);

  const analyzeUploads = useCallback(async (before: File, after: File | null) => {
    const token = ++analysis.current;
    const total: 1 | 2 = after ? 2 : 1;
    setError("");
    setAnalyzeProgress({
      scene: "before",
      phase: "prepare",
      of: total,
      detail: before.name,
    });
    const watch =
      (scene: "before" | "after") => (phase: AnalyzePhase) => {
        if (token !== analysis.current) return;
        const mapped =
          phase.phase === "upload" || phase.phase === "fetch"
            ? "fetch"
            : phase.phase === "infer"
              ? "infer"
              : "prepare";
        setAnalyzeProgress({
          scene: total === 1 ? "after" : scene,
          phase: mapped,
          of: total,
          loaded: "loaded" in phase ? phase.loaded : undefined,
          total: "total" in phase ? phase.total : undefined,
          detail: "detail" in phase ? phase.detail : undefined,
        });
      };
    try {
      const first = await api.analyze(before, "flood", watch("before"));
      const second = after
        ? await api.analyze(after, "flood", watch("after"), first.id)
        : null;
      if (token !== analysis.current) return false;
      const names = second ? `${before.name} → ${after?.name}` : before.name;
      setAnalyzeProgress(null);
      dispatch({
        type: "uploadResult",
        result: uploadsToResult(first, second, names),
      });
      return true;
    } catch (err) {
      if (token === analysis.current) {
        setAnalyzeProgress(null);
        setError(errorMessage(err, "No se pudo analizar el GeoTIFF."));
      }
      return false;
    }
  }, []);

  const restoreAnalysis = useCallback(
    (id: string) => {
      const found = state.history.some((r) => r.id === id);
      if (!found) return false;
      bumpTokens();
      setError("");
      setAnalyzeProgress(null);
      setLoading(false);
      setCatalog([[], []]);
      setDrawing(false);
      setPanelOpen(true);
      dispatch({ type: "restore", id });
      return true;
    },
    [bumpTokens, state.history],
  );

  const selectScene = useCallback(
    (index: 0 | 1, scene: Scene) => {
      const token = ++previewReq.current;
      dispatch({
        type: "scene",
        index,
        scene: {
          ...scene,
          previewStatus: "loading",
          mapPreviewUrl: undefined,
          mapPreviewBounds: undefined,
        },
      });
      const q = catalogQueryFromAoi(
        state.aoi,
        scene.datetime.slice(0, 10),
        maxCloud,
        maxSideKmRef.current,
      );
      void api
        .catalogPreview(scene.id, {
          lat: q.lat,
          lon: q.lon,
          sideKm: q.sideKm,
        })
        .then((preview) => {
          if (token !== previewReq.current) return;
          const bounds = preview.bounds;
          if (bounds.length < 4) throw new Error("bounds inválidos");
          dispatch({
            type: "scenePreview",
            index,
            sceneId: scene.id,
            patch: {
              previewStatus: "ready",
              mapPreviewUrl: preview.url,
              mapPreviewBounds: [
                bounds[0],
                bounds[1],
                bounds[2],
                bounds[3],
              ] as BBox,
            },
          });
        })
        .catch(() => {
          if (token !== previewReq.current) return;
          dispatch({
            type: "scenePreview",
            index,
            sceneId: scene.id,
            patch: {
              previewStatus: "error",
              mapPreviewUrl: undefined,
              mapPreviewBounds: undefined,
            },
          });
        });
    },
    [state.aoi, maxCloud],
  );

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setFullscreen(true);
      }
    } catch {
      setError("No se pudo activar pantalla completa.");
    }
  }, []);

  useEffect(() => {
    void api
      .catalogLimits()
      .then((limits: CatalogLimits) => {
        if (Number.isFinite(limits.max_side_km) && limits.max_side_km > 0) {
          setMaxSideKm(limits.max_side_km);
        }
      })
      .catch(() => {
        /* conservar default */
      });
  }, []);

  useEffect(
    () => () => {
      request.current++;
      analysis.current++;
      previewReq.current++;
    },
    [],
  );

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const value = useMemo<MapAppContextValue>(
    () => ({
      state,
      provider,
      query,
      setQuery,
      drawing,
      setDrawing,
      error,
      setError,
      catalog,
      loading,
      setLoading,
      searchOpen,
      setSearchOpen,
      panelOpen,
      setPanelOpen,
      fullscreen,
      analyzeProgress,
      maxCloud,
      setMaxCloud,
      maxSideKm,
      patch,
      setArea,
      findScenes,
      analyze,
      analyzeUploads,
      restoreAnalysis,
      selectScene,
      dispatch,
      bumpTokens,
      toggleFullscreen,
    }),
    [
      state,
      provider,
      query,
      drawing,
      error,
      catalog,
      loading,
      searchOpen,
      panelOpen,
      fullscreen,
      analyzeProgress,
      maxCloud,
      setMaxCloud,
      maxSideKm,
      patch,
      setArea,
      findScenes,
      analyze,
      analyzeUploads,
      restoreAnalysis,
      selectScene,
      bumpTokens,
      toggleFullscreen,
    ],
  );

  return (
    <MapAppContext.Provider value={value}>{children}</MapAppContext.Provider>
  );
}

export function useMapApp(): MapAppContextValue {
  const ctx = useContext(MapAppContext);
  if (!ctx) throw new Error("useMapApp debe usarse dentro de MapAppProvider");
  return ctx;
}
