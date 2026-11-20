import { ChevronRight, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import { useMapApp } from "../../app/MapAppProvider";
import { useAppPage } from "../../app/useAppPage";
import { aoiFromPoint, parseCoords } from "../../domain/aoi";
import {
  emptyBox,
  floatingChromeLeft,
  floatingColumnWidth,
  sidebarSearchWidth,
} from "../ui/classes";
import { cn } from "../ui/cn";

type GeocodeHit = { label: string; lat: number; lon: number };

const SIDE_KM = 35;
const MAX_SIDE_KM = 150;
const DEBOUNCE_MS = 300;

const rowBtn =
  "flex w-full cursor-pointer items-center justify-start gap-2 rounded-none border-0 bg-transparent px-1.5 py-2.5 text-left text-[13px] hover:bg-accent-soft";

export default function PlaceSearch() {
  const {
    state,
    provider,
    query,
    setQuery,
    searchOpen,
    setSearchOpen,
    setArea,
    panelOpen,
  } = useMapApp();
  const page = useAppPage();
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const coords = parseCoords(query);
  const q = query.trim();
  const presets = provider.places.filter((p) =>
    !q ? true : p.label.toLowerCase().includes(q.toLowerCase()),
  );

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setError("");

    if (parseCoords(q) || q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = window.setTimeout(() => {
      void api
        .geocode(q, ctrl.signal)
        .then((rows) => {
          if (!ctrl.signal.aborted) {
            setHits(rows);
            setError("");
          }
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return;
          setHits([]);
          const msg =
            err instanceof Error && err.message.trim()
              ? err.message
              : "No se pudo buscar el lugar.";
          setError(msg);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  if (page !== "map") return null;

  const sidebarNarrow = state.variant === "sidebar" && panelOpen;
  const showEmpty =
    !loading &&
    !error &&
    !coords &&
    !presets.length &&
    !hits.length &&
    q.length >= 2;

  return (
    <div
      className={cn(
        "absolute top-6 z-[750] max-lg:top-5 max-sm:top-3.5",
        floatingChromeLeft,
        sidebarNarrow ? sidebarSearchWidth : floatingColumnWidth,
        "max-sm:w-[calc(100%-5.5rem)]",
      )}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setSearchOpen(false);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "flex h-[52px] w-full items-center gap-3.5 rounded-pill border border-search-border bg-paper px-5",
          "text-fg-muted shadow-[0_3px_12px_#15324816]",
          "max-lg:h-[48px] max-[760px]:h-[44px]",
          sidebarNarrow && "px-4",
        )}
      >
        <Search size={22} className="shrink-0" aria-hidden />
        <label className="sr-only" htmlFor="place">
          Buscar lugar o coordenadas
        </label>
        <input
          id="place"
          className={cn(
            "min-w-0 w-full border-0 bg-transparent text-[15px] text-fg outline-none",
            "placeholder:text-fg-soft max-lg:text-[13px] max-sm:text-xs",
            sidebarNarrow && "text-xs",
          )}
          placeholder="Lugar o lat, lon (ej. 27.1, 67.95)"
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
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        />
      </div>
      {searchOpen && (
        <div
          className="mt-2.5 max-h-[min(50vh,22rem)] w-full overflow-auto rounded-md border border-line bg-paper p-3 shadow-[0_8px_20px_#12253520]"
          role="listbox"
          aria-label="Resultados de búsqueda"
        >
          {presets.length > 0 && (
            <div className="mb-1">
              <p className="m-0 px-1.5 pb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-fg-soft">
                Demostración
              </p>
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  role="option"
                  className={rowBtn}
                  onClick={() => {
                    setArea(p.bbox, p.label);
                    setQuery("");
                    setSearchOpen(false);
                    setHits([]);
                  }}
                >
                  <MapPin size={16} className="shrink-0" />
                  <span className="min-w-0 truncate">{p.label}</span>
                  <ChevronRight size={15} className="ml-auto shrink-0" />
                </button>
              ))}
            </div>
          )}

          {coords && (
            <button
              type="button"
              role="option"
              className={rowBtn}
              onClick={() => {
                setArea(
                  aoiFromPoint(coords, SIDE_KM, MAX_SIDE_KM).bbox,
                  "Coordenadas",
                );
                setQuery("");
                setSearchOpen(false);
                setHits([]);
              }}
            >
              <MapPin size={16} className="shrink-0" />
              Usar coordenadas ({coords.lat.toFixed(4)}, {coords.lon.toFixed(4)})
              <ChevronRight size={15} className="ml-auto shrink-0" />
            </button>
          )}

          {!coords && q.length >= 2 && (
            <div className="mt-1 border-t border-line pt-2">
              <p className="m-0 px-1.5 pb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-fg-soft">
                Lugares
              </p>
              {loading && (
                <p className="m-0 px-1.5 py-2 text-[12px] text-fg-muted">
                  Buscando…
                </p>
              )}
              {error && !loading && (
                <p className={`${emptyBox} mb-0`} role="alert">
                  {error}
                </p>
              )}
              {!loading &&
                !error &&
                hits.map((h) => (
                  <button
                    key={`${h.label}-${h.lat}-${h.lon}`}
                    type="button"
                    role="option"
                    className={rowBtn}
                    onClick={() => {
                      setArea(
                        aoiFromPoint(
                          { lat: h.lat, lon: h.lon },
                          SIDE_KM,
                          MAX_SIDE_KM,
                        ).bbox,
                        h.label,
                      );
                      setQuery("");
                      setSearchOpen(false);
                      setHits([]);
                    }}
                  >
                    <MapPin size={16} className="shrink-0" />
                    <span className="min-w-0 truncate">{h.label}</span>
                    <ChevronRight size={15} className="ml-auto shrink-0" />
                  </button>
                ))}
              {showEmpty && (
                <p className={`${emptyBox} mb-0`}>Sin coincidencias.</p>
              )}
            </div>
          )}

          {!q && !coords && (
            <p className="m-0 px-1.5 pt-1 text-[11px] text-fg-soft">
              Escribe un nombre o pega lat, lon.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
