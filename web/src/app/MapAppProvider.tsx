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
import {
  initialState,
  reducer,
  type DataProvider,
  type Scene,
  type State,
} from "../domain/lab";
import { tuneProvider } from "../data/tuneProvider";
import type { BBox } from "../domain/aoi";

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
  patch: (p: ViewPatch) => void;
  setArea: (bbox: BBox, label: string) => void;
  findScenes: () => Promise<void>;
  analyze: () => Promise<void>;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
  bumpTokens: () => void;
  toggleFullscreen: () => Promise<void>;
};

const MapAppContext = createContext<MapAppContextValue | null>(null);

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
  const request = useRef(0);
  const analysis = useRef(0);

  const patch = useCallback((p: ViewPatch) => {
    dispatch({ type: "view", patch: p });
  }, []);

  const bumpTokens = useCallback(() => {
    analysis.current++;
    request.current++;
  }, []);

  const setArea = useCallback(
    (bbox: BBox, label: string) => {
      bumpTokens();
      dispatch({ type: "area", bbox, label });
      setDrawing(false);
      setLoading(false);
      setSearchOpen(false);
      setPanelOpen(true);
      setError("");
      setCatalog([[], []]);
    },
    [bumpTokens],
  );

  const findScenes = useCallback(async () => {
    const token = ++request.current;
    setLoading(true);
    setError("");
    try {
      const scenes = await Promise.all(
        state.dates.map((d) => provider.scenes(state.aoi, d)),
      );
      if (token === request.current) {
        setCatalog(scenes as [Scene[], Scene[]]);
        dispatch({ type: "step", step: "scenes" });
      }
    } catch {
      if (token === request.current) {
        setError("No se pudieron consultar las imágenes.");
      }
    } finally {
      if (token === request.current) setLoading(false);
    }
  }, [provider, state.aoi, state.dates]);

  const analyze = useCallback(async () => {
    if (!state.selected[0] || !state.selected[1]) return;
    const token = ++analysis.current;
    dispatch({ type: "step", step: "running" });
    setError("");
    try {
      const result = await provider.analyze(
        state.aoi,
        state.selected[0],
        state.selected[1],
      );
      if (token === analysis.current) dispatch({ type: "result", result });
    } catch {
      if (token === analysis.current) {
        setError("No se pudo completar el análisis.");
        dispatch({ type: "step", step: "ready" });
      }
    }
  }, [provider, state.aoi, state.selected]);

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

  useEffect(
    () => () => {
      request.current++;
      analysis.current++;
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
      patch,
      setArea,
      findScenes,
      analyze,
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
      patch,
      setArea,
      findScenes,
      analyze,
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
