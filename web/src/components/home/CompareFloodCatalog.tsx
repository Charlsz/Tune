import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { api } from "../../api";
import { clampSideKm, formatPlaceCoords, parseCoords } from "../../lib/aoi";
import { paths } from "../../router/paths";
import type { Analysis, CatalogScene, Place } from "../../types";
import { LocationMap } from "./LocationMap";

const PRESETS: { label: string; place: Place; hint: string }[] = [
  { label: "Bogotá", place: { lat: 4.71, lon: -74.07 }, hint: "Andes" },
  { label: "Magdalena", place: { lat: 8.85, lon: -74.65 }, hint: "humedal" },
  { label: "Valencia (ES)", place: { lat: 39.47, lon: -0.38 }, hint: "Europa" },
  { label: "Sindh (PK)", place: { lat: 27.7, lon: 68.85 }, hint: "evento 2022" },
];

type DemoPair = {
  id: string;
  label: string;
  place: Place;
  placeLabel: string;
  beforeStart: string;
  beforeEnd: string;
  afterStart: string;
  afterEnd: string;
  beforeItem: string;
  afterItem: string;
  sideKm: number;
};

const DEMO_PAIRS: DemoPair[] = [
  {
    id: "sindh-2022",
    label: "Sindh 2022 (verificado)",
    place: { lat: 27.7, lon: 68.85 },
    placeLabel: "Sindh (PK)",
    beforeStart: "2022-05-10",
    beforeEnd: "2022-05-25",
    afterStart: "2022-08-28",
    afterEnd: "2022-09-12",
    beforeItem: "S2B_42RVR_20220518_0_L2A",
    afterItem: "S2B_42RVR_20220905_0_L2A",
    sideKm: 12,
  },
  {
    id: "magdalena-2022",
    label: "Magdalena 2022 (verificado)",
    place: { lat: 8.85, lon: -74.65 },
    placeLabel: "Magdalena",
    beforeStart: "2022-02-15",
    beforeEnd: "2022-03-01",
    afterStart: "2022-05-01",
    afterEnd: "2022-05-15",
    beforeItem: "S2B_18PWQ_20220222_0_L2A",
    afterItem: "S2A_18PWQ_20220508_0_L2A",
    sideKm: 12,
  },
  {
    id: "mississippi-2019",
    label: "Mississippi 2019 (verificado)",
    place: { lat: 37.0, lon: -89.18 },
    placeLabel: "Mississippi",
    beforeStart: "2018-09-10",
    beforeEnd: "2018-09-25",
    afterStart: "2019-06-01",
    afterEnd: "2019-06-15",
    beforeItem: "S2B_16SBF_20180918_0_L2A",
    afterItem: "S2A_16SBF_20190610_0_L2A",
    sideKm: 12,
  },
];

const DEFAULT_MAX_KM = 30;
const DRAFT_KEY = "tune.compare.v1";

type SlotId = "before" | "after";

type SlotState = {
  start: string;
  end: string;
  selectedId: string | null;
};

type Draft = {
  text: string;
  place: Place | null;
  sideKm: number;
  maxCloud: number;
  before: SlotState;
  after: SlotState;
};

type GeoHit = { label: string; lat: number; lon: number };

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

function saveDraft(draft: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

function SceneList({
  scenes,
  loading,
  selectedId,
  busy,
  preferredId,
  onSelect,
}: {
  scenes: CatalogScene[] | null;
  loading: boolean;
  selectedId: string | null;
  busy: boolean;
  preferredId?: string;
  onSelect: (scene: CatalogScene) => void;
}) {
  if (loading) return <p className="caption">Consultando Sentinel-2…</p>;
  if (!scenes) return <p className="caption">Elige fechas para listar escenas.</p>;
  if (scenes.length === 0) {
    return (
      <p className="caption catalog-error">
        Sin escenas en ese rango. Amplía fechas o sube nubes máx.
      </p>
    );
  }
  return (
    <ul className="catalog-list compare-scene-list">
      {scenes.map((s) => {
        const preferred = preferredId === s.id;
        const on = selectedId === s.id;
        return (
          <li key={s.id} className={on ? "is-selected" : undefined}>
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
                {s.cloud_cover.toFixed(0)}% nubes
                {preferred ? " · recomendada" : ""}
              </span>
            </div>
            <button
              type="button"
              className={on ? "primary" : "secondary"}
              disabled={busy}
              onClick={() => onSelect(s)}
            >
              {on ? "Elegida" : "Elegir"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function CompareFloodCatalog({
  place,
  busy,
  history,
  onPlace,
  onAnalyze,
  onComparePair,
  onOpenPair,
}: {
  place: Place | null;
  busy: boolean;
  history: Analysis[] | null;
  onPlace: (place: Place | null) => void;
  onAnalyze: (itemId: string, at: Place, sideKm: number, maxCloud: number) => void;
  onComparePair: (
    beforeItemId: string,
    afterItemId: string,
    at: Place,
    sideKm: number,
    maxCloud: number,
  ) => void;
  onOpenPair: (before: Analysis, after: Analysis, at?: Place | null) => void;
}) {
  const saved = useMemo(() => loadDraft(), []);
  const [text, setText] = useState(saved?.text ?? "");
  const [coordError, setCoordError] = useState<string | null>(null);
  const [geoHits, setGeoHits] = useState<GeoHit[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [maxCloud, setMaxCloud] = useState(saved?.maxCloud ?? 40);
  const [sideKm, setSideKm] = useState(saved?.sideKm ?? 12);
  const [maxSideKm, setMaxSideKm] = useState(DEFAULT_MAX_KM);
  const [before, setBefore] = useState<SlotState>(
    saved?.before ?? { start: "2022-05-10", end: "2022-05-25", selectedId: null },
  );
  const [after, setAfter] = useState<SlotState>(
    saved?.after ?? { start: "2022-08-28", end: "2022-09-12", selectedId: null },
  );
  const [beforeScenes, setBeforeScenes] = useState<CatalogScene[] | null>(null);
  const [afterScenes, setAfterScenes] = useState<CatalogScene[] | null>(null);
  const [beforeLoading, setBeforeLoading] = useState(false);
  const [afterLoading, setAfterLoading] = useState(false);
  const [beforeError, setBeforeError] = useState<string | null>(null);
  const [afterError, setAfterError] = useState<string | null>(null);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<{ before?: string; after?: string }>({});
  const [mapDraft, setMapDraft] = useState<Place | null>(null);
  const geoAbort = useRef<AbortController | null>(null);
  const beforeAbort = useRef<AbortController | null>(null);
  const afterAbort = useRef<AbortController | null>(null);

  const placeKey = place ? `${place.lat},${place.lon}` : "";
  const draftPending =
    mapDraft != null &&
    (place == null || mapDraft.lat !== place.lat || mapDraft.lon !== place.lon);

  useEffect(() => {
    let cancelled = false;
    api
      .catalogLimits()
      .then((lim) => {
        if (cancelled) return;
        setMaxSideKm(lim.max_side_km);
        setSideKm((prev) => clampSideKm(prev, lim.max_side_km));
      })
      .catch(() => {
        /* límites por defecto si el catálogo no responde */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (saved?.place) {
      onPlace(saved.place);
      setMapDraft(saved.place);
    }
    // hydrate once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveDraft({
      text,
      place,
      sideKm,
      maxCloud,
      before,
      after,
    });
  }, [text, place, sideKm, maxCloud, before, after]);

  function applyPlace(next: Place, label?: string) {
    setText(label ?? formatPlaceCoords(next));
    setCoordError(null);
    setGeoHits([]);
    setMapDraft(next);
    onPlace(next);
  }

  function confirmMapDraft() {
    if (!mapDraft) return;
    setActiveDemo(null);
    setPreferred({});
    applyPlace(mapDraft);
  }

  function clearPlace() {
    setText("");
    setCoordError(null);
    setGeoHits([]);
    setMapDraft(null);
    setBeforeScenes(null);
    setAfterScenes(null);
    setActiveDemo(null);
    setPreferred({});
    onPlace(null);
  }

  async function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const asCoords = parseCoords(text);
    if (asCoords) {
      setActiveDemo(null);
      setPreferred({});
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
      setActiveDemo(null);
      setPreferred({});
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

  async function searchSlot(
    slot: SlotId,
    at: Place,
    start: string,
    end: string,
    preferId?: string,
  ) {
    const abort = slot === "before" ? beforeAbort : afterAbort;
    const setLoading = slot === "before" ? setBeforeLoading : setAfterLoading;
    const setScenes = slot === "before" ? setBeforeScenes : setAfterScenes;
    const setError = slot === "before" ? setBeforeError : setAfterError;
    const setSlot = slot === "before" ? setBefore : setAfter;

    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setLoading(true);
    setError(null);
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
        setError("No hay escenas con estos filtros.");
        return;
      }
      const pick =
        (preferId && items.find((s) => s.id === preferId)) ||
        items.find((s) => s.id === (slot === "before" ? before.selectedId : after.selectedId)) ||
        items[0];
      if (pick) {
        setSlot((prev) => ({ ...prev, selectedId: pick.id }));
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
      setScenes([]);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!place) {
      setBeforeScenes(null);
      setAfterScenes(null);
      beforeAbort.current?.abort();
      afterAbort.current?.abort();
      return;
    }
    const t1 = window.setTimeout(
      () => void searchSlot("before", place, before.start, before.end, preferred.before),
      300,
    );
    const t2 = window.setTimeout(
      () => void searchSlot("after", place, after.start, after.end, preferred.after),
      320,
    );
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      beforeAbort.current?.abort();
      afterAbort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    placeKey,
    before.start,
    before.end,
    after.start,
    after.end,
    maxCloud,
    sideKm,
    maxSideKm,
    preferred.before,
    preferred.after,
  ]);

  function applyDemo(demo: DemoPair) {
    setActiveDemo(demo.id);
    setPreferred({ before: demo.beforeItem, after: demo.afterItem });
    setSideKm(clampSideKm(demo.sideKm, maxSideKm));
    setMaxCloud(40);
    setBefore({ start: demo.beforeStart, end: demo.beforeEnd, selectedId: demo.beforeItem });
    setAfter({ start: demo.afterStart, end: demo.afterEnd, selectedId: demo.afterItem });
    applyPlace(demo.place, demo.placeLabel);
  }

  const beforeScene =
    beforeScenes?.find((s) => s.id === before.selectedId) ??
    beforeScenes?.find((s) => s.id === preferred.before) ??
    null;
  const afterScene =
    afterScenes?.find((s) => s.id === after.selectedId) ??
    afterScenes?.find((s) => s.id === preferred.after) ??
    null;

  const beforeDate = dateKey(beforeScene?.datetime);
  const afterDate = dateKey(afterScene?.datetime);

  const placeHistory = useMemo(() => {
    return (history ?? []).filter((a) => a.task === "flood");
  }, [history]);

  const beforeRun = useMemo(() => {
    if (!beforeDate) return null;
    return placeHistory.find((a) => dateKey(a.acquired_at) === beforeDate) ?? null;
  }, [placeHistory, beforeDate]);

  const afterRun = useMemo(() => {
    if (!afterDate) return null;
    return placeHistory.find((a) => dateKey(a.acquired_at) === afterDate) ?? null;
  }, [placeHistory, afterDate]);

  const datesOk =
    beforeDate != null && afterDate != null ? beforeDate < afterDate : beforeDate == null || afterDate == null;

  function runSlot(slot: SlotId) {
    if (!place) return;
    const scene = slot === "before" ? beforeScene : afterScene;
    if (!scene) return;
    onAnalyze(scene.id, place, Math.min(sideKm, maxSideKm), maxCloud);
  }

  function runCompare() {
    if (!place || !beforeScene || !afterScene || !datesOk) return;
    const side = Math.min(sideKm, maxSideKm);
    if (beforeRun && afterRun) {
      onOpenPair(beforeRun, afterRun, place);
      return;
    }
    if (beforeRun && !afterRun) {
      // Baseline ya en historial: solo hace falta el Después.
      onAnalyze(afterScene.id, place, side, maxCloud);
      return;
    }
    onComparePair(beforeScene.id, afterScene.id, place, side, maxCloud);
  }

  const canCompare = Boolean(place && beforeScene && afterScene && datesOk);

  return (
    <div className="location-catalog compare-flood">
      <form className="coord-search" onSubmit={(e) => void submitSearch(e)}>
        <div className="search">
          <input
            aria-label="Lugar o coordenadas"
            placeholder="Lugar o coordenadas  ·  ej. Bogotá  o  27.7, 68.85"
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
                  onClick={() => {
                    setActiveDemo(null);
                    setPreferred({});
                    applyPlace({ lat: h.lat, lon: h.lon }, h.label);
                  }}
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
                place && place.lat === p.place.lat && place.lon === p.place.lon && !activeDemo
                  ? "on"
                  : undefined
              }
              onClick={() => {
                setActiveDemo(null);
                setPreferred({});
                applyPlace(p.place, p.label);
              }}
              title={p.hint}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="demo-steps" role="group" aria-label="Pares verificados">
          <p className="caption demo-steps-label">
            Pares verificados (rellenan Antes + Después con fechas reales):
          </p>
          <div className="presets demo-presets">
            {DEMO_PAIRS.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={busy}
                className={activeDemo === d.id ? "on" : undefined}
                onClick={() => applyDemo(d)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {coordError && <p className="caption catalog-error">{coordError}</p>}
        {place && (
          <p className="caption place-active">
            Punto confirmado:{" "}
            <span className="num">{formatPlaceCoords(place)}</span>
            <button type="button" className="close" disabled={busy} onClick={clearPlace}>
              Quitar
            </button>
          </p>
        )}
      </form>

      <section className="tune-map-section" aria-label="Mapa de ubicación">
        <LocationMap
          place={place}
          draft={mapDraft}
          sideKm={sideKm}
          maxSideKm={maxSideKm}
          disabled={busy}
          onDraft={(next) => {
            setMapDraft(next);
            setActiveDemo(null);
            setCoordError(null);
          }}
          onSideKm={(km) => setSideKm(clampSideKm(km, maxSideKm))}
        />
        <div className="tune-map-confirm">
          {draftPending && mapDraft ? (
            <>
              <p className="caption">
                Borrador: <span className="num">{formatPlaceCoords(mapDraft)}</span>
                {" · "}
                el rectángulo es el área que se enviará a Sentinel-2 ({sideKm} km de lado).
              </p>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={confirmMapDraft}
              >
                Confirmar ubicación
              </button>
            </>
          ) : place ? (
            <p className="caption">
              Ubicación lista para buscar escenas. Ajusta el recorte en el mapa si hace falta
              (máx. {maxSideKm} km).
            </p>
          ) : (
            <p className="caption">
              Busca un lugar, usa un atajo o haz clic en el mapa; luego confirma para enlazar el
              catálogo STAC.
            </p>
          )}
        </div>
      </section>

      {!place && (
        <p className="caption location-hint">
          1) Confirma el lugar en el mapa. 2) Elige una escena <strong>Antes</strong> y otra{" "}
          <strong>Después</strong>. 3) Pulsa <strong>Comparar par</strong> (hace las dos corridas y
          abre el lado a lado) o analízalas una a una. Guía:{" "}
          <Link to={paths.howToUse}>How to use</Link>.
        </p>
      )}

      {place && (
        <>
          <div className="compare-shared-filters">
            <label className="field">
              Nubes máx. %
              <input
                type="number"
                min={0}
                max={100}
                value={maxCloud}
                disabled={busy}
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
                disabled={busy}
                onChange={(e) => setSideKm(clampSideKm(Number(e.target.value) || 1, maxSideKm))}
              />
            </label>
            <p className="caption cloud-note compare-note">
              Recorte máx. {maxSideKm} km (límite de procesamiento). Misma ubicación en las dos
              columnas. Orden: <strong>Antes → Después</strong>. El modelo detecta agua; la
              inundación se interpreta como agua nueva frente a la referencia.
            </p>
          </div>

          <div className="compare-grid" role="group" aria-label="Antes y después">
            <section className="compare-col" aria-labelledby="compare-before-title">
              <header className="compare-col-head">
                <h3 id="compare-before-title">Antes</h3>
                <p className="caption">Línea base (río / agua normal)</p>
              </header>
              <div className="compare-dates">
                <label className="field">
                  Desde
                  <input
                    type="date"
                    value={before.start}
                    disabled={busy || beforeLoading}
                    onChange={(e) => setBefore((p) => ({ ...p, start: e.target.value }))}
                  />
                </label>
                <label className="field">
                  Hasta
                  <input
                    type="date"
                    value={before.end}
                    disabled={busy || beforeLoading}
                    onChange={(e) => setBefore((p) => ({ ...p, end: e.target.value }))}
                  />
                </label>
              </div>
              {beforeError && <p className="caption catalog-error">{beforeError}</p>}
              <SceneList
                scenes={beforeScenes}
                loading={beforeLoading}
                selectedId={before.selectedId}
                busy={busy}
                preferredId={preferred.before}
                onSelect={(s) => setBefore((p) => ({ ...p, selectedId: s.id }))}
              />
              <div className="compare-col-foot">
                <p className="caption">
                  {beforeScene ? (
                    <>
                      Escena: <strong className="num">{beforeDate}</strong>
                      {beforeRun ? (
                        <>
                          {" "}
                          · lista ({beforeRun.affected_area_km2?.toFixed(1) ?? "—"} km² agua)
                        </>
                      ) : (
                        " · pendiente de analizar"
                      )}
                    </>
                  ) : (
                    "Elige una escena de la lista"
                  )}
                </p>
                <button
                  type="button"
                  className="primary wide"
                  disabled={busy || !beforeScene}
                  onClick={() => runSlot("before")}
                >
                  {beforeRun ? "Reanalizar Antes" : "1 · Analizar Antes"}
                </button>
              </div>
            </section>

            <section className="compare-col" aria-labelledby="compare-after-title">
              <header className="compare-col-head">
                <h3 id="compare-after-title">Después</h3>
                <p className="caption">Fecha pico / inundación</p>
              </header>
              <div className="compare-dates">
                <label className="field">
                  Desde
                  <input
                    type="date"
                    value={after.start}
                    disabled={busy || afterLoading}
                    onChange={(e) => setAfter((p) => ({ ...p, start: e.target.value }))}
                  />
                </label>
                <label className="field">
                  Hasta
                  <input
                    type="date"
                    value={after.end}
                    disabled={busy || afterLoading}
                    onChange={(e) => setAfter((p) => ({ ...p, end: e.target.value }))}
                  />
                </label>
              </div>
              {afterError && <p className="caption catalog-error">{afterError}</p>}
              <SceneList
                scenes={afterScenes}
                loading={afterLoading}
                selectedId={after.selectedId}
                busy={busy}
                preferredId={preferred.after}
                onSelect={(s) => setAfter((p) => ({ ...p, selectedId: s.id }))}
              />
              <div className="compare-col-foot">
                <p className="caption">
                  {afterScene ? (
                    <>
                      Escena: <strong className="num">{afterDate}</strong>
                      {afterRun?.change ? (
                        <>
                          {" "}
                          · nueva {afterRun.change.new_area_km2?.toFixed(1) ?? "—"} km² · perm.{" "}
                          {afterRun.change.persistent_area_km2?.toFixed(1) ?? "—"} km²
                        </>
                      ) : afterRun ? (
                        " · analizada"
                      ) : beforeRun ? (
                        " · listo para comparar"
                      ) : (
                        " · primero analiza Antes"
                      )}
                    </>
                  ) : (
                    "Elige una escena de la lista"
                  )}
                </p>
                <button
                  type="button"
                  className="primary wide"
                  disabled={busy || !afterScene || !beforeRun || !datesOk}
                  onClick={() => runSlot("after")}
                  title={
                    !beforeRun
                      ? "Analiza Antes primero"
                      : !datesOk
                        ? "La fecha Después debe ser posterior a Antes"
                        : undefined
                  }
                >
                  {afterRun ? "Reanalizar Después" : "2 · Analizar Después"}
                </button>
              </div>
            </section>
          </div>

          {!datesOk && beforeDate && afterDate && (
            <p className="caption catalog-error">
              La fecha Después ({afterDate}) debe ser posterior a Antes ({beforeDate}).
            </p>
          )}

          <div className="compare-pair-cta">
            <button
              type="button"
              className="primary wide"
              disabled={busy || !canCompare}
              onClick={runCompare}
            >
              {beforeRun && afterRun
                ? "Abrir comparación (ya en historial)"
                : beforeRun
                  ? "Comparar par · analiza solo Después"
                  : "Comparar par · Antes y Después"}
            </button>
            <p className="caption">
              Un solo clic: guarda ambas escenas en el historial del lugar y muestra inundación
              como agua nueva (rojo) frente a la línea base.
            </p>
          </div>

          <div className="compare-status" aria-live="polite">
            <div>
              <span className="compare-status-label">Antes</span>
              <strong className="num">{beforeDate ?? "—"}</strong>
              {beforeRun ? (
                <span className="caption">ok · baseline guardada</span>
              ) : (
                <span className="caption">sin analizar</span>
              )}
            </div>
            <span className="compare-arrow" aria-hidden>
              →
            </span>
            <div>
              <span className="compare-status-label">Después</span>
              <strong className="num">{afterDate ?? "—"}</strong>
              {afterRun?.change ? (
                <span className="caption">
                  nueva {afterRun.change.new_area_km2?.toFixed(1)} · permanente{" "}
                  {afterRun.change.persistent_area_km2?.toFixed(1)} km²
                </span>
              ) : (
                <span className="caption">
                  {beforeRun ? "pendiente" : "espera el Antes"}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
