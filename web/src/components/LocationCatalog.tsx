import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { CatalogScene, Place, TaskId } from "../types";

const PRESETS: { label: string; place: Place; hint: string }[] = [
  { label: "Bogotá", place: { lat: 4.71, lon: -74.07 }, hint: "Andes" },
  { label: "Magdalena", place: { lat: 8.85, lon: -74.65 }, hint: "humedal" },
  { label: "Valencia (ES)", place: { lat: 39.47, lon: -0.38 }, hint: "Europa" },
  { label: "Sindh (PK)", place: { lat: 27.7, lon: 68.85 }, hint: "evento 2022" },
];

const DEFAULT_MAX_KM = 30;

type GeoHit = { label: string; lat: number; lon: number };

function monthAgoIso(): string {
  return new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseCoords(raw: string): Place | null {
  const match = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/** Ubicación (nombre o coordenadas) + catálogo Sentinel-2 (solo inundación). */
export function LocationCatalog({
  place,
  busy,
  task,
  onPlace,
  onAnalyze,
}: {
  place: Place | null;
  busy: boolean;
  task: TaskId;
  onPlace: (place: Place | null) => void;
  onAnalyze: (
    itemId: string,
    task: TaskId,
    at: Place,
    sideKm: number,
    maxCloud: number,
  ) => void;
}) {
  const catalogOk = task === "flood";
  const [text, setText] = useState("");
  const [coordError, setCoordError] = useState<string | null>(null);
  const [geoHits, setGeoHits] = useState<GeoHit[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [start, setStart] = useState(monthAgoIso);
  const [end, setEnd] = useState(todayIso);
  const [maxCloud, setMaxCloud] = useState(40);
  const [sideKm, setSideKm] = useState(20);
  const [maxSideKm, setMaxSideKm] = useState(DEFAULT_MAX_KM);
  const [scenes, setScenes] = useState<CatalogScene[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const geoAbort = useRef<AbortController | null>(null);
  const placeKey = place ? `${place.lat},${place.lon}` : "";
  const filterKey = `${start}|${end}|${maxCloud}|${sideKm}`;

  useEffect(() => {
    let cancelled = false;
    api
      .catalogLimits()
      .then((lim) => {
        if (cancelled) return;
        setMaxSideKm(lim.max_side_km);
        setSideKm((prev) => Math.min(prev, lim.max_side_km));
      })
      .catch(() => {
        /* fallback DEFAULT_MAX_KM */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyPlace(next: Place, label?: string) {
    setText(label ?? `${next.lat}, ${next.lon}`);
    setCoordError(null);
    setGeoHits([]);
    onPlace(next);
  }

  function clearPlace() {
    setText("");
    setCoordError(null);
    setGeoHits([]);
    setScenes(null);
    setSearchError(null);
    onPlace(null);
  }

  async function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const asCoords = parseCoords(text);
    if (asCoords) {
      applyPlace(asCoords);
      return;
    }
    const q = text.trim();
    if (q.length < 2) {
      setCoordError("Escribe un lugar (ej. Bogotá) o coordenadas (ej. 4.71, -74.07).");
      return;
    }
    geoAbort.current?.abort();
    const ac = new AbortController();
    geoAbort.current = ac;
    setGeoLoading(true);
    setCoordError(null);
    setGeoHits([]);
    try {
      const hits = await api.geocode(q, ac.signal);
      if (ac.signal.aborted) return;
      if (hits.length === 0) {
        setCoordError("No se encontró ese lugar. Prueba otro nombre o coordenadas.");
        return;
      }
      if (hits.length === 1) {
        applyPlace({ lat: hits[0].lat, lon: hits[0].lon }, hits[0].label);
        return;
      }
      setGeoHits(hits);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setCoordError((err as Error).message);
    } finally {
      if (!ac.signal.aborted) setGeoLoading(false);
    }
  }

  async function runSearch(at: Place) {
    if (!catalogOk) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setSearchError(null);
    try {
      const items = await api.catalogSearch(
        {
          lat: at.lat,
          lon: at.lon,
          start,
          end,
          maxCloud,
          sideKm: Math.min(sideKm, maxSideKm),
        },
        ac.signal,
      );
      if (ac.signal.aborted) return;
      setScenes(items);
      if (items.length === 0) {
        setSearchError(
          "No hay escenas con estos filtros. Amplía fechas o sube el máximo de nubes de la escena.",
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setSearchError((err as Error).message);
      setScenes([]);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!place || !catalogOk) {
      setScenes(null);
      setSearchError(null);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    const t = window.setTimeout(() => void runSearch(place), 350);
    return () => {
      window.clearTimeout(t);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey, filterKey, catalogOk, maxSideKm]);

  return (
    <div className="location-catalog">
      <form className="coord-search" onSubmit={(e) => void submitSearch(e)}>
        <div className="search">
          <input
            aria-label="Lugar o coordenadas"
            placeholder="Lugar o coordenadas  ·  ej. Bogotá  o  4.71, -74.07"
            value={text}
            disabled={busy}
            onChange={(e) => {
              setText(e.target.value);
              setGeoHits([]);
            }}
          />
          <button className="primary" type="submit" disabled={busy || geoLoading}>
            {geoLoading ? "…" : "Buscar"}
          </button>
        </div>

        {geoHits.length > 0 && (
          <ul className="geo-hits" role="listbox" aria-label="Resultados de lugar">
            {geoHits.map((h) => (
              <li key={`${h.lat},${h.lon},${h.label}`}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => applyPlace({ lat: h.lat, lon: h.lon }, h.label)}
                >
                  {h.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="presets" role="group" aria-label="Atajos de ubicación">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={busy}
              className={
                place && place.lat === p.place.lat && place.lon === p.place.lon ? "on" : undefined
              }
              onClick={() => applyPlace(p.place, p.label)}
              title={p.hint}
            >
              {p.label}
            </button>
          ))}
        </div>

        {coordError && <p className="caption catalog-error">{coordError}</p>}
        {place && (
          <p className="caption place-active">
            Punto:{" "}
            <span className="num">
              {place.lat.toFixed(4)}, {place.lon.toFixed(4)}
            </span>
            <button type="button" className="close" disabled={busy} onClick={clearPlace}>
              Quitar
            </button>
          </p>
        )}
      </form>

      {!catalogOk && (
        <p className="callout warn catalog-task-note">
          El catálogo Earth Search es Sentinel-2 L2A y alimenta <strong>inundación</strong>. Para
          cicatriz de incendio usa un GeoTIFF HLS o una escena de ejemplo Burn Scars más abajo.
        </p>
      )}

      {catalogOk && !place && (
        <p className="caption location-hint">
          Busca por nombre de ciudad o región, por coordenadas, o usa un atajo. Luego elige una
          escena Sentinel-2 de la lista.
        </p>
      )}

      {catalogOk && place && (
        <>
          <div className="catalog-filters-inline">
            <label className="field">
              Desde
              <input
                type="date"
                value={start}
                disabled={busy || loading}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="field">
              Hasta
              <input
                type="date"
                value={end}
                disabled={busy || loading}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <label className="field">
              Nubes máx. %
              <input
                type="number"
                min={0}
                max={100}
                value={maxCloud}
                disabled={busy || loading}
                onChange={(e) => setMaxCloud(Number(e.target.value))}
              />
            </label>
            <label className="field">
              Recorte (km)
              <input
                type="number"
                min={1}
                max={maxSideKm}
                value={sideKm}
                disabled={busy || loading}
                onChange={(e) =>
                  setSideKm(Math.min(maxSideKm, Math.max(1, Number(e.target.value) || 1)))
                }
              />
            </label>
            <button
              type="button"
              className="secondary"
              disabled={busy || loading}
              onClick={() => void runSearch(place)}
            >
              {loading ? "Buscando…" : "Actualizar lista"}
            </button>
          </div>

          <p className="caption cloud-note">
            Recorte máx. {maxSideKm} km. El % de nubes de cada fila es de toda la escena (~100 km);
            al analizar se comprueba la nubosidad real de tu recorte.
          </p>

          {loading && <p className="caption">Consultando catálogo Sentinel-2…</p>}
          {searchError && <p className="caption catalog-error">{searchError}</p>}

          {scenes && scenes.length > 0 && !loading && (
            <>
              <p className="caption catalog-count">
                {scenes.length} escena{scenes.length === 1 ? "" : "s"} · pulsa Analizar
              </p>
              <ul className="catalog-list">
                {scenes.map((s) => (
                  <li key={s.id}>
                    {s.thumbnail ? (
                      <img
                        className="catalog-thumb"
                        src={s.thumbnail}
                        alt=""
                        loading="lazy"
                        width={56}
                        height={56}
                      />
                    ) : (
                      <span className="catalog-thumb catalog-thumb-empty" aria-hidden />
                    )}
                    <div className="catalog-meta">
                      <span className="num">{s.datetime.slice(0, 10)}</span>
                      <span className="caption">
                        {s.cloud_cover.toFixed(0)}% nubes (escena)
                      </span>
                    </div>
                    <button
                      type="button"
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        onAnalyze(s.id, task, place, Math.min(sideKm, maxSideKm), maxCloud)
                      }
                    >
                      Analizar
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
