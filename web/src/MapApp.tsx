import { useEffect, useReducer, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Search,
  Scan,
  MapPin,
  Layers,
  PanelLeft,
  RectangleHorizontal,
  Check,
  ChevronRight,
  Maximize,
  Minimize,
} from "lucide-react";
import MapView from "./components/map/MapView";
import VisualizationControls from "./components/map/VisualizationControls";
import {
  initialState,
  reducer,
  formatDate,
  type DataProvider,
  type Scene,
  type State,
} from "./domain/lab";
import { tuneProvider } from "./data/tuneProvider";
import { parseCoords, aoiFromPoint, type BBox } from "./domain/aoi";

const titles = {
  area: "Área",
  dates: "Fechas",
  scenes: "Imágenes",
  ready: "Comparación",
  running: "Analizando",
  results: "Resultado",
};
const stages = ["Área", "Fechas", "Imágenes", "Comparación"];

export default function MapApp({
  provider = tuneProvider,
}: {
  provider?: DataProvider;
}) {
  const [s, dispatch] = useReducer(reducer, initialState),
    [query, setQuery] = useState(""),
    [drawing, setDrawing] = useState(false),
    [error, setError] = useState(""),
    [catalog, setCatalog] = useState<[Scene[], Scene[]]>([[], []]),
    [loading, setLoading] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [panelOpen, setPanelOpen] = useState(true),
    [fullscreen, setFullscreen] = useState(false);
  const request = useRef(0),
    analysis = useRef(0);
  const view = (patch: Parameters<typeof reducer>[1] & { type: "view" }) =>
    dispatch(patch);
  const patch = (
    p: Partial<
      Pick<
        State,
        "page" | "mode" | "mask" | "opacity" | "slider" | "split" | "variant"
      >
    >,
  ) => view({ type: "view", patch: p });

  function area(bbox: BBox, label: string) {
    analysis.current++;
    request.current++;
    dispatch({ type: "area", bbox, label });
    setDrawing(false);
    setLoading(false);
    setSearchOpen(false);
    setPanelOpen(true);
    setError("");
    setCatalog([[], []]);
  }

  async function findScenes() {
    const token = ++request.current;
    setLoading(true);
    setError("");
    try {
      const scenes = await Promise.all(
        s.dates.map((d) => provider.scenes(s.aoi, d)),
      );
      if (token === request.current) {
        setCatalog(scenes as [Scene[], Scene[]]);
        dispatch({ type: "step", step: "scenes" });
      }
    } catch {
      if (token === request.current) setError("No se pudieron consultar las imágenes.");
    } finally {
      if (token === request.current) setLoading(false);
    }
  }

  async function analyze() {
    if (!s.selected[0] || !s.selected[1]) return;
    const token = ++analysis.current;
    dispatch({ type: "step", step: "running" });
    setError("");
    try {
      const result = await provider.analyze(
        s.aoi,
        s.selected[0],
        s.selected[1],
      );
      if (token === analysis.current) dispatch({ type: "result", result });
    } catch {
      if (token === analysis.current) {
        setError("No se pudo completar el análisis.");
        dispatch({ type: "step", step: "ready" });
      }
    }
  }

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

  const stage =
    s.step === "area"
      ? 0
      : s.step === "dates"
        ? 1
        : s.step === "scenes"
          ? 2
          : 3;
  const matches = provider.places.filter((p) =>
    p.label.toLowerCase().includes(query.toLowerCase()),
  );
  const result = s.result;

  return (
    <div className="app">
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            patch({ page: "map" });
          }}
        >
          <span className="brand-mark">
            <img src="/icons/tune-icon.svg" alt="" width={32} height={32} />
          </span>
          Tune
        </a>
        <nav aria-label="Navegación principal">
          {(["map", "results", "history"] as const).map((p, i) => (
            <button
              key={p}
              className={s.page === p ? "active" : ""}
              onClick={() => {
                patch({ page: p });
                setPanelOpen(true);
              }}
            >
              {["Mapa", "Resultados", "Historial"][i]}
            </button>
          ))}
        </nav>
      </header>
      <main
        className={`workspace ${s.variant} ${panelOpen ? "" : "panel-collapsed"}`}
      >
        {s.page === "map" && (
          <div
            className="search-dock"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget))
                setSearchOpen(false);
            }}
          >
            <div className="global-search">
              <Search size={22} />
              <label className="sr-only" htmlFor="place">
                Buscar
              </label>
              <input
                id="place"
                placeholder="Lugar o coordenadas…"
                autoComplete="off"
                value={query}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearchOpen(false);
                }}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
              />
            </div>
            {searchOpen && (
              <div className="search-results">
                {matches.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      area(p.bbox, p.label);
                      setQuery("");
                    }}
                  >
                    <MapPin size={16} />
                    {p.label}
                    <ChevronRight size={15} />
                  </button>
                ))}
                {!matches.length && <p className="empty">Sin coincidencias.</p>}
                {parseCoords(query) && (
                  <button
                    onClick={() =>
                      area(
                        aoiFromPoint(parseCoords(query)!, 35, 150).bbox,
                        "Coordenadas",
                      )
                    }
                  >
                    Usar coordenadas
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="map-surface">
          <MapView
            state={s}
            drawing={drawing}
            onArea={area}
            onError={setError}
            waterCells={provider.maskCells}
          />
          <div className="map-label">{s.label}</div>
          <div className="map-tools">
            <button
              aria-label={panelOpen ? "Ocultar panel" : "Mostrar panel"}
              aria-pressed={panelOpen}
              onClick={() => setPanelOpen(!panelOpen)}
            >
              <Layers size={24} />
            </button>
            <button
              aria-label={
                fullscreen ? "Salir de pantalla completa" : "Pantalla completa"
              }
              onClick={async () => {
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
              }}
            >
              {fullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>
          </div>
          <div className="variant-switch" aria-label="Variante">
            <button
              aria-pressed={s.variant === "floating"}
              onClick={() => patch({ variant: "floating" })}
            >
              <RectangleHorizontal size={16} /> A
            </button>
            <button
              aria-pressed={s.variant === "sidebar"}
              onClick={() => patch({ variant: "sidebar" })}
            >
              <PanelLeft size={16} /> B
            </button>
          </div>
          {result && s.page === "map" && s.slider && (
            <div className="swipe">
              <div className="swipe-line" style={{ left: `${s.split}%` }}>
                <span>↔</span>
              </div>
              <input
                type="range"
                aria-label="División temporal"
                min="0"
                max="100"
                value={s.split}
                onChange={(e) => patch({ split: +e.target.value })}
              />
              <div className="swipe-label left">Antes</div>
              <div className="swipe-label right">Después</div>
            </div>
          )}
        </div>
        <aside className="panel" hidden={!panelOpen}>
          {s.page === "map" ? (
            <>
              {s.step !== "results" && (
                <div className="steps" aria-label="Progreso">
                  {stages.map((name, i) => (
                    <span
                      key={name}
                      title={name}
                      className={i <= stage ? "done" : ""}
                    >
                      {i < stage ? <Check size={12} /> : i + 1}
                    </span>
                  ))}
                </div>
              )}
              <div className="panel-heading">
                <Layers size={25} />
                <h1>{titles[s.step]}</h1>
              </div>
              {s.step === "area" && (
                <>
                  <div className="selected-area">
                    <MapPin size={18} />
                    <div>
                      <strong>{s.label}</strong>
                    </div>
                  </div>
                  <button
                    className={`outline full ${drawing ? "selected" : ""}`}
                    onClick={() => setDrawing(!drawing)}
                  >
                    <Scan size={17} />
                    {drawing ? "Cancelar" : "Dibujar"}
                  </button>
                  <button
                    className="primary full"
                    onClick={() => {
                      setDrawing(false);
                      dispatch({ type: "step", step: "dates" });
                    }}
                  >
                    Continuar
                    <ArrowRight size={17} />
                  </button>
                </>
              )}
              {s.step === "dates" && (
                <>
                  <div className="location-summary">
                    <MapPin size={15} />
                    {s.label}
                    <button
                      onClick={() => dispatch({ type: "step", step: "area" })}
                    >
                      Cambiar
                    </button>
                  </div>
                  {s.dates.map((d, i) => (
                    <label className="date-field" key={i}>
                      <span>{i === 0 ? "Antes" : "Después"}</span>
                      <input
                        aria-label={i === 0 ? "Fecha Antes" : "Fecha Después"}
                        type="date"
                        value={d}
                        onChange={(e) => {
                          analysis.current++;
                          request.current++;
                          setLoading(false);
                          dispatch({
                            type: "date",
                            index: i as 0 | 1,
                            value: e.target.value,
                          });
                        }}
                      />
                    </label>
                  ))}
                  {s.dates[0] >= s.dates[1] && (
                    <p role="alert">Después debe ser posterior a Antes.</p>
                  )}
                  <button
                    className="primary full"
                    disabled={
                      loading ||
                      !s.dates[0] ||
                      !s.dates[1] ||
                      s.dates[0] >= s.dates[1]
                    }
                    onClick={findScenes}
                  >
                    {loading ? "Consultando…" : "Consultar"}
                    <ArrowRight size={17} />
                  </button>
                </>
              )}
              {s.step === "scenes" && (
                <>
                  <button
                    className="text-button"
                    onClick={() => dispatch({ type: "step", step: "dates" })}
                  >
                    <ArrowLeft size={14} /> Fechas
                  </button>
                  {catalog.map((scenes, i) => (
                    <section className="scene-group" key={i}>
                      <h2>
                        {i === 0 ? "Antes" : "Después"}{" "}
                        <span>{formatDate(s.dates[i])}</span>
                      </h2>
                      {!scenes.length ? (
                        <p className="empty">Sin imágenes.</p>
                      ) : (
                        scenes.map((scene, j) => (
                          <button
                            className={`scene ${s.selected[i]?.id === scene.id ? "chosen" : ""}`}
                            aria-pressed={s.selected[i]?.id === scene.id}
                            key={scene.id}
                            onClick={() =>
                              dispatch({
                                type: "scene",
                                index: i as 0 | 1,
                                scene,
                              })
                            }
                          >
                            <img
                              src={scene.image}
                              alt={`Vista previa ${j + 1}`}
                            />
                            <div>
                              <strong>Imagen {j + 1}</strong>
                            </div>
                            <span className="radio">
                              {s.selected[i]?.id === scene.id && (
                                <Check size={12} />
                              )}
                            </span>
                          </button>
                        ))
                      )}
                    </section>
                  ))}
                  <button
                    className="primary full"
                    disabled={!s.selected[0] || !s.selected[1]}
                    onClick={() => dispatch({ type: "step", step: "ready" })}
                  >
                    Comparar
                    <ArrowRight size={16} />
                  </button>
                </>
              )}
              {(s.step === "ready" || s.step === "running") && (
                <>
                  <div className="comparison-summary">
                    {s.selected.map((scene, i) => (
                      <div key={i}>
                        <span>{i === 0 ? "Antes" : "Después"}</span>
                        <strong>{scene && formatDate(scene.datetime)}</strong>
                      </div>
                    ))}
                  </div>
                  {s.step === "running" ? (
                    <div className="running" role="status">
                      <span className="status-dot" /> Analizando…
                    </div>
                  ) : (
                    <>
                      <button className="primary full" onClick={analyze}>
                        Analizar
                        <ArrowRight size={17} />
                      </button>
                      <button
                        className="text-button"
                        onClick={() =>
                          dispatch({ type: "step", step: "scenes" })
                        }
                      >
                        Cambiar imágenes
                      </button>
                    </>
                  )}
                </>
              )}
              {s.step === "results" && result && (
                <VisualizationControls
                  state={s}
                  onView={patch}
                  onDates={() => dispatch({ type: "step", step: "dates" })}
                />
              )}
            </>
          ) : s.page === "results" ? (
            <>
              <h1>Resultados</h1>
              {result ? (
                <>
                  <div className="comparison-summary">
                    <p>Antes — {formatDate(result.before.datetime)}</p>
                    <p>Después — {formatDate(result.after.datetime)}</p>
                  </div>
                  <div className="result-number">
                    <strong>
                      {result.areaKm2.toLocaleString("es", {
                        maximumFractionDigits: 2,
                      })}
                      <span> km²</span>
                    </strong>
                  </div>
                  <button
                    className="primary full"
                    onClick={() => patch({ page: "map" })}
                  >
                    Ver en el mapa
                    <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <p className="empty">Sin resultado.</p>
              )}
            </>
          ) : (
            <>
              <h1>Historial</h1>
              {!s.history.length ? (
                <p className="empty">Vacío.</p>
              ) : (
                s.history.map((r, i) => (
                  <div className="history-entry" key={r.id}>
                    <strong>Comparación {s.history.length - i}</strong>
                    <p>
                      {formatDate(r.before.datetime)} →{" "}
                      {formatDate(r.after.datetime)}
                    </p>
                    <small>
                      {r.areaKm2.toFixed(2)} km² ·{" "}
                      {new Date(r.created).toLocaleTimeString("es")}
                    </small>
                  </div>
                ))
              )}
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </aside>
      </main>
    </div>
  );
}
