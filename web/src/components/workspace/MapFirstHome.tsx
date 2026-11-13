import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { api } from "../../api";
import { findCompatibleAnalysis } from "../../lib/analysisMatch";
import {
  aoiFromPoint,
  aoiFromRectangle,
  aoiLabel,
  aoiPlace,
  aoiSideKm,
  bboxDimensionsKm,
  clampSideKm,
  formatBbox,
  formatPlaceCoords,
  parseCoords,
  type Aoi,
  type AoiMode,
  type BBox,
} from "../../lib/aoi";
import { dateKey, pickBestPair, rankScenes, type RankedScene } from "../../lib/sceneRank";
import { paths } from "../../router/paths";
import type { Analysis, Place } from "../../types";
import { MapCanvas, type ResultLayerId } from "../map/MapCanvas";

const DRAFT_KEY = "tune.mapfirst.v1";
const DEFAULT_MAX_KM = 30;

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
    label: "Sindh 2022",
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
    label: "Magdalena 2022",
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
    label: "Mississippi 2019",
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

type PanelPhase =
  | "idle"
  | "draft"
  | "ready"
  | "searching"
  | "scenes"
  | "prepared"
  | "running"
  | "results"
  | "error";

type Props = {
  busy: boolean;
  history: Analysis[] | null;
  selected: Analysis | null;
  pair: { before: Analysis; after: Analysis } | null;
  onPlace: (place: Place | null) => void;
  onComparePair: (
    beforeItemId: string,
    afterItemId: string,
    at: Place,
    sideKm: number,
    maxCloud: number,
    bbox?: string,
  ) => void;
  onOpenPair: (before: Analysis, after: Analysis, at?: Place | null) => void;
};

type GeoHit = { label: string; lat: number; lon: number };

function loadSession(): Partial<{
  mode: AoiMode;
  sideKm: number;
  maxCloud: number;
  beforeStart: string;
  beforeEnd: string;
  afterStart: string;
  afterEnd: string;
}> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function MapFirstHome({
  busy,
  history,
  selected,
  pair,
  onPlace,
  onComparePair,
  onOpenPair,
}: Props) {
  const saved = useMemo(() => loadSession(), []);
  const [mode, setMode] = useState<AoiMode>(saved?.mode ?? "point");
  const [maxSideKm, setMaxSideKm] = useState(DEFAULT_MAX_KM);
  const [sideKm, setSideKm] = useState(saved?.sideKm ?? 12);
  const [maxCloud, setMaxCloud] = useState(saved?.maxCloud ?? 40);
  const [draftAoi, setDraftAoi] = useState<Aoi | null>(null);
  const [confirmedAoi, setConfirmedAoi] = useState<Aoi | null>(null);
  const [rectDraft, setRectDraft] = useState<BBox | null>(null);
  const [fitKey, setFitKey] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [geoHits, setGeoHits] = useState<GeoHit[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [aoiError, setAoiError] = useState<string | null>(null);
  const [beforeStart, setBeforeStart] = useState(saved?.beforeStart ?? "2022-05-10");
  const [beforeEnd, setBeforeEnd] = useState(saved?.beforeEnd ?? "2022-05-25");
  const [afterStart, setAfterStart] = useState(saved?.afterStart ?? "2022-08-28");
  const [afterEnd, setAfterEnd] = useState(saved?.afterEnd ?? "2022-09-12");
  const [beforeScenes, setBeforeScenes] = useState<RankedScene[] | null>(null);
  const [afterScenes, setAfterScenes] = useState<RankedScene[] | null>(null);
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<{ before?: string; after?: string }>({});
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [resultLayer, setResultLayer] = useState<ResultLayerId>("change");
  const [opacity, setOpacity] = useState(0.72);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const geoAbort = useRef<AbortController | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    api
      .catalogLimits()
      .then((lim) => {
        if (cancelled) return;
        setMaxSideKm(lim.max_side_km);
        setSideKm((s) => clampSideKm(s, lim.max_side_km));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          mode,
          sideKm,
          maxCloud,
          beforeStart,
          beforeEnd,
          afterStart,
          afterEnd,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [mode, sideKm, maxCloud, beforeStart, beforeEnd, afterStart, afterEnd]);

  const activeAoi = confirmedAoi;
  const dims = activeAoi ? bboxDimensionsKm(activeAoi.bbox) : null;

  const beforeScene = beforeScenes?.find((s) => s.id === beforeId) ?? null;
  const afterScene = afterScenes?.find((s) => s.id === afterId) ?? null;
  const beforeDate = dateKey(beforeScene?.datetime);
  const afterDate = dateKey(afterScene?.datetime);
  const datesOk =
    beforeDate != null && afterDate != null
      ? beforeDate < afterDate
      : beforeDate == null || afterDate == null;

  const beforeRun =
    activeAoi && beforeDate
      ? findCompatibleAnalysis(history, {
          date: beforeDate,
          aoi: activeAoi,
          sceneId: beforeId,
        })
      : null;
  const afterRun =
    activeAoi && afterDate
      ? findCompatibleAnalysis(history, {
          date: afterDate,
          aoi: activeAoi,
          sceneId: afterId,
        })
      : null;

  const canAnalyze = Boolean(activeAoi && beforeScene && afterScene && datesOk && !busy);

  const panelPhase: PanelPhase = (() => {
    if (busy) return "running";
    if (pair || (selected && selected.change)) return "results";
    if (searchError && !beforeScenes && !afterScenes) return "error";
    if (searching) return "searching";
    if (beforeScene && afterScene && datesOk) return "prepared";
    if (beforeScenes || afterScenes) return "scenes";
    if (confirmedAoi) return "ready";
    if (draftAoi) return "draft";
    return "idle";
  })();

  function bumpFit(aoi: Aoi) {
    setFitKey(`${Date.now()}:${aoi.bbox.join(",")}`);
  }

  function setPointDraft(place: Place, label?: string) {
    setAoiError(null);
    setPreferred({});
    setBeforeScenes(null);
    setAfterScenes(null);
    setBeforeId(null);
    setAfterId(null);
    setSearchError(null);
    const next = aoiFromPoint(place, sideKm, maxSideKm, label);
    setDraftAoi(next);
    setConfirmedAoi(null);
    onPlace(null);
  }

  function commitRect(bbox: BBox) {
    const next = aoiFromRectangle(bbox, maxSideKm);
    if ("error" in next) {
      setAoiError(next.error);
      return;
    }
    setAoiError(null);
    setPreferred({});
    setBeforeScenes(null);
    setAfterScenes(null);
    setBeforeId(null);
    setAfterId(null);
    setDraftAoi(next);
    setConfirmedAoi(null);
    onPlace(null);
  }

  function confirmAoi() {
    if (!draftAoi) return;
    if (draftAoi.mode === "point") {
      const refreshed = aoiFromPoint(draftAoi.center, sideKm, maxSideKm, draftAoi.label);
      setConfirmedAoi(refreshed);
      setDraftAoi(refreshed);
      onPlace(refreshed.center);
      bumpFit(refreshed);
      return;
    }
    const rect = draftAoi;
    setConfirmedAoi(rect);
    onPlace(aoiPlace(rect));
    bumpFit(rect);
  }

  function clearAoi() {
    searchAbort.current?.abort();
    setDraftAoi(null);
    setConfirmedAoi(null);
    setRectDraft(null);
    setBeforeScenes(null);
    setAfterScenes(null);
    setBeforeId(null);
    setAfterId(null);
    setPreferred({});
    setSearchError(null);
    setAoiError(null);
    setGeoHits([]);
    onPlace(null);
  }

  function applySideKm(next: number) {
    const side = clampSideKm(next, maxSideKm);
    setSideKm(side);
    if (draftAoi?.mode === "point") {
      const updated = aoiFromPoint(draftAoi.center, side, maxSideKm, draftAoi.label);
      setDraftAoi(updated);
      if (confirmedAoi?.mode === "point") {
        setConfirmedAoi(updated);
        // No bumpFit: el usuario está ajustando tamaño, no cambiando lugar.
      }
    }
  }

  async function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const asCoords = parseCoords(searchText);
    if (asCoords) {
      setMode("point");
      setPointDraft(asCoords);
      bumpFit(aoiFromPoint(asCoords, sideKm, maxSideKm));
      return;
    }
    const q = searchText.trim();
    if (q.length < 2) {
      setAoiError("Escribe un lugar (ej. Bogotá) o coordenadas (ej. 4.71, -74.07).");
      return;
    }
    geoAbort.current?.abort();
    const ac = new AbortController();
    geoAbort.current = ac;
    setGeoLoading(true);
    setAoiError(null);
    setGeoHits([]);
    try {
      const hits = await api.geocode(q, ac.signal);
      if (ac.signal.aborted) return;
      if (hits.length === 0) {
        setAoiError("No se encontró ese lugar. Prueba otro nombre o coordenadas.");
        return;
      }
      setMode("point");
      if (hits.length === 1) {
        const place = { lat: hits[0].lat, lon: hits[0].lon };
        setPointDraft(place, hits[0].label);
        bumpFit(aoiFromPoint(place, sideKm, maxSideKm, hits[0].label));
        setSearchText(hits[0].label);
        return;
      }
      setGeoHits(hits);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setAoiError((err as Error).message);
    } finally {
      if (!ac.signal.aborted) setGeoLoading(false);
    }
  }

  async function searchScenes() {
    if (!confirmedAoi) return;
    searchAbort.current?.abort();
    const ac = new AbortController();
    searchAbort.current = ac;
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchError(null);
    setPickOpen(false);
    const place = aoiPlace(confirmedAoi);
    const bbox = formatBbox(confirmedAoi.bbox);
    const side = aoiSideKm(confirmedAoi);
    try {
      const [beforeRaw, afterRaw] = await Promise.all([
        api.catalogSearch(
          {
            lat: place.lat,
            lon: place.lon,
            start: beforeStart,
            end: beforeEnd,
            maxCloud,
            sideKm: side,
            bbox,
          },
          ac.signal,
        ),
        api.catalogSearch(
          {
            lat: place.lat,
            lon: place.lon,
            start: afterStart,
            end: afterEnd,
            maxCloud,
            sideKm: side,
            bbox,
          },
          ac.signal,
        ),
      ]);
      if (ac.signal.aborted || seq !== searchSeq.current) return;
      const beforeRanked = rankScenes(beforeRaw, confirmedAoi.bbox, maxCloud);
      const afterRanked = rankScenes(afterRaw, confirmedAoi.bbox, maxCloud);
      setBeforeScenes(beforeRanked);
      setAfterScenes(afterRanked);
      if (beforeRanked.length === 0 && afterRanked.length === 0) {
        setSearchError("Sin escenas en esos rangos. Amplía fechas o sube nubes máx.");
        setBeforeId(null);
        setAfterId(null);
        return;
      }
      const preferredPair = pickBestPair(
        preferred.before
          ? beforeRanked.filter((s) => s.id === preferred.before).concat(beforeRanked)
          : beforeRanked,
        preferred.after
          ? afterRanked.filter((s) => s.id === preferred.after).concat(afterRanked)
          : afterRanked,
      );
      const b =
        (preferred.before && beforeRanked.find((s) => s.id === preferred.before)) ||
        preferredPair.before;
      const a =
        (preferred.after && afterRanked.find((s) => s.id === preferred.after)) ||
        preferredPair.after;
      setBeforeId(b?.id ?? null);
      setAfterId(a?.id ?? null);
      if (!b || !a) {
        setSearchError("No hay un par temporalmente válido. Ajusta las fechas.");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (seq !== searchSeq.current) return;
      setSearchError((err as Error).message || "No se pudo consultar el catálogo.");
      setBeforeScenes(null);
      setAfterScenes(null);
    } finally {
      if (!ac.signal.aborted && seq === searchSeq.current) setSearching(false);
    }
  }

  function applyDemo(demo: DemoPair) {
    setMode("point");
    setSideKm(clampSideKm(demo.sideKm, maxSideKm));
    setMaxCloud(40);
    setBeforeStart(demo.beforeStart);
    setBeforeEnd(demo.beforeEnd);
    setAfterStart(demo.afterStart);
    setAfterEnd(demo.afterEnd);
    setPreferred({ before: demo.beforeItem, after: demo.afterItem });
    const aoi = aoiFromPoint(demo.place, demo.sideKm, maxSideKm, demo.placeLabel);
    setDraftAoi(aoi);
    setConfirmedAoi(aoi);
    onPlace(demo.place);
    setSearchText(demo.placeLabel);
    bumpFit(aoi);
    setAoiError(null);
  }

  useEffect(() => {
    if (!confirmedAoi || !preferred.before) return;
    void searchScenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferred.before, preferred.after, confirmedAoi?.bbox.join(",")]);

  function runCompare() {
    if (!activeAoi || !beforeScene || !afterScene || !datesOk) return;
    const place = aoiPlace(activeAoi);
    const side = aoiSideKm(activeAoi);
    const bbox = formatBbox(activeAoi.bbox);
    if (beforeRun && afterRun) {
      onOpenPair(beforeRun, afterRun, place);
      return;
    }
    onComparePair(beforeScene.id, afterScene.id, place, side, maxCloud, bbox);
  }

  const resultAnalysis = pair?.after ?? selected;

  return (
    <div className="map-first">
      <section className="map-first-stage" aria-label="Mapa de análisis">
        <div className="map-first-toolbar">
          <div className="map-mode" role="group" aria-label="Modo de selección">
            <button
              type="button"
              className={mode === "point" ? "on" : undefined}
              disabled={busy}
              onClick={() => setMode("point")}
            >
              Punto
            </button>
            <button
              type="button"
              className={mode === "rectangle" ? "on" : undefined}
              disabled={busy}
              onClick={() => setMode("rectangle")}
            >
              Rectángulo
            </button>
          </div>
          <form className="map-search" onSubmit={(e) => void submitSearch(e)}>
            <input
              aria-label="Buscar lugar o coordenadas"
              placeholder="Buscar lugar o coords…"
              value={searchText}
              disabled={busy || geoLoading}
              onChange={(e) => {
                setSearchText(e.target.value);
                setGeoHits([]);
              }}
            />
            <button type="submit" className="secondary" disabled={busy || geoLoading}>
              {geoLoading ? "…" : "Ir"}
            </button>
          </form>
        </div>
        {geoHits.length > 0 && (
          <ul className="map-geo-hits" role="listbox" aria-label="Resultados">
            {geoHits.map((h) => (
              <li key={`${h.lat},${h.lon},${h.label}`}>
                <button
                  type="button"
                  onClick={() => {
                    setMode("point");
                    setPointDraft({ lat: h.lat, lon: h.lon }, h.label);
                    bumpFit(aoiFromPoint({ lat: h.lat, lon: h.lon }, sideKm, maxSideKm, h.label));
                    setSearchText(h.label);
                    setGeoHits([]);
                  }}
                >
                  {h.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="map-first-canvas">
          <MapCanvas
            mode={mode}
            draftAoi={draftAoi}
            confirmedAoi={confirmedAoi}
            rectDraft={rectDraft}
            disabled={busy}
            result={panelPhase === "results" || panelPhase === "running" ? resultAnalysis : null}
            resultLayer={resultLayer}
            resultOpacity={opacity}
            onPointDraft={(p) => setPointDraft(p)}
            onRectDraft={setRectDraft}
            onRectCommit={commitRect}
            onFitRequestKey={fitKey}
          />
        </div>
        {mode === "point" && (draftAoi || confirmedAoi) && (
          <div className="map-side-control">
            <label>
              Recorte {sideKm} km
              <input
                type="range"
                min={1}
                max={maxSideKm}
                value={sideKm}
                disabled={busy}
                onChange={(e) => applySideKm(Number(e.target.value))}
              />
            </label>
          </div>
        )}
      </section>

      <aside className="map-first-panel" aria-label="Panel de análisis">
        <header className="map-panel-head">
          <h1>Tune</h1>
          <p className="caption">
            Agua nueva entre dos fechas · no es inundación confirmada automáticamente
          </p>
        </header>

        {panelPhase === "idle" && (
          <div className="map-panel-body">
            <p className="map-panel-lead">Selecciona un área para comenzar</p>
            <p className="caption">
              {mode === "point"
                ? "Haz clic en el mapa o busca un lugar. Luego confirma el área."
                : "Arrastra un rectángulo sobre el mapa (máx. " + maxSideKm + " km)."}
            </p>
            {aoiError && <p className="caption catalog-error">{aoiError}</p>}
            <div className="map-demos">
              <p className="caption">Casos verificados</p>
              <div className="presets demo-presets">
                {DEMO_PAIRS.map((d) => (
                  <button key={d.id} type="button" disabled={busy} onClick={() => applyDemo(d)}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {(panelPhase === "draft" || aoiError) && draftAoi && !confirmedAoi && (
          <div className="map-panel-body">
            <p className="caption">
              Borrador · {aoiLabel(draftAoi)}
              {draftAoi.mode === "point"
                ? ` · ${sideKm} km`
                : ` · ~${bboxDimensionsKm(draftAoi.bbox).widthKm.toFixed(1)}×${bboxDimensionsKm(draftAoi.bbox).heightKm.toFixed(1)} km`}
            </p>
            {aoiError && <p className="caption catalog-error">{aoiError}</p>}
            <button type="button" className="primary wide" disabled={busy || !!aoiError} onClick={confirmAoi}>
              Usar este área
            </button>
            <button type="button" className="secondary wide" disabled={busy} onClick={clearAoi}>
              Cancelar
            </button>
          </div>
        )}

        {(panelPhase === "ready" || panelPhase === "searching" || panelPhase === "error") &&
          confirmedAoi && (
            <div className="map-panel-body">
              <p className="caption place-active">
                {aoiLabel(confirmedAoi)}
                {dims
                  ? ` · ~${Math.max(dims.heightKm, dims.widthKm).toFixed(1)} km`
                  : ""}
                <button type="button" className="close" disabled={busy} onClick={clearAoi}>
                  Quitar
                </button>
              </p>
              <div className="compare-dates map-panel-dates">
                <label className="field">
                  Antes desde
                  <input
                    type="date"
                    value={beforeStart}
                    disabled={busy || searching}
                    onChange={(e) => setBeforeStart(e.target.value)}
                  />
                </label>
                <label className="field">
                  hasta
                  <input
                    type="date"
                    value={beforeEnd}
                    disabled={busy || searching}
                    onChange={(e) => setBeforeEnd(e.target.value)}
                  />
                </label>
                <label className="field">
                  Después desde
                  <input
                    type="date"
                    value={afterStart}
                    disabled={busy || searching}
                    onChange={(e) => setAfterStart(e.target.value)}
                  />
                </label>
                <label className="field">
                  hasta
                  <input
                    type="date"
                    value={afterEnd}
                    disabled={busy || searching}
                    onChange={(e) => setAfterEnd(e.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                Nubes máx. %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={maxCloud}
                  disabled={busy || searching}
                  onChange={(e) => setMaxCloud(Number(e.target.value))}
                />
              </label>
              {searchError && <p className="caption catalog-error">{searchError}</p>}
              <button
                type="button"
                className="primary wide"
                disabled={busy || searching}
                onClick={() => void searchScenes()}
              >
                {searching ? "Buscando imágenes…" : "Buscar imágenes"}
              </button>
              {searching && (
                <button
                  type="button"
                  className="secondary wide"
                  onClick={() => searchAbort.current?.abort()}
                >
                  Cancelar búsqueda
                </button>
              )}
            </div>
          )}

        {(panelPhase === "scenes" || panelPhase === "prepared") && confirmedAoi && (
          <div className="map-panel-body">
            <p className="caption">
              Propuesta por metadatos (cobertura del área + nubes). Puedes cambiarla.
            </p>
            <div className="map-scene-pair">
              <div>
                <h3>Antes</h3>
                {beforeScene ? (
                  <>
                    <p className="num">{beforeDate}</p>
                    <p className="caption">
                      {beforeScene.cloud_cover.toFixed(0)}% nubes · cobertura{" "}
                      {Math.round(beforeScene.coverage * 100)}%
                    </p>
                    <p className="caption">{beforeScene.reasons[0]}</p>
                  </>
                ) : (
                  <p className="caption catalog-error">Sin escena</p>
                )}
              </div>
              <div>
                <h3>Después</h3>
                {afterScene ? (
                  <>
                    <p className="num">{afterDate}</p>
                    <p className="caption">
                      {afterScene.cloud_cover.toFixed(0)}% nubes · cobertura{" "}
                      {Math.round(afterScene.coverage * 100)}%
                    </p>
                    <p className="caption">{afterScene.reasons[0]}</p>
                  </>
                ) : (
                  <p className="caption catalog-error">Sin escena</p>
                )}
              </div>
            </div>
            {!datesOk && beforeDate && afterDate && (
              <p className="caption catalog-error">
                Después ({afterDate}) debe ser posterior a Antes ({beforeDate}).
              </p>
            )}
            <button
              type="button"
              className="secondary wide"
              disabled={busy}
              onClick={() => setPickOpen((v) => !v)}
            >
              {pickOpen ? "Ocultar lista" : "Cambiar imágenes"}
            </button>
            {pickOpen && (
              <div className="map-scene-lists">
                <ScenePicker
                  title="Antes"
                  scenes={beforeScenes}
                  selectedId={beforeId}
                  onSelect={setBeforeId}
                  busy={busy}
                />
                <ScenePicker
                  title="Después"
                  scenes={afterScenes}
                  selectedId={afterId}
                  onSelect={setAfterId}
                  busy={busy}
                />
              </div>
            )}
            {panelPhase === "prepared" && (
              <>
                <button
                  type="button"
                  className="primary wide"
                  disabled={!canAnalyze}
                  onClick={runCompare}
                >
                  {beforeRun && afterRun
                    ? "Abrir resultado (historial compatible)"
                    : "Analizar agua nueva"}
                </button>
                <p className="caption">
                  El modelo detecta agua; Tune marca agua nueva frente a la fecha Antes.
                </p>
              </>
            )}
            <button type="button" className="secondary wide" disabled={busy} onClick={() => void searchScenes()}>
              Volver a buscar
            </button>
          </div>
        )}

        {panelPhase === "running" && (
          <div className="map-panel-body">
            <p className="map-panel-lead">Analizando…</p>
            <p className="caption">Descarga de bandas e inferencia. No inventamos porcentajes.</p>
          </div>
        )}

        {panelPhase === "results" && resultAnalysis && (
          <div className="map-panel-body">
            <p className="map-panel-lead">Resultado en el mapa</p>
            {resultAnalysis.change ? (
              <p className="caption">
                Nueva {resultAnalysis.change.new_area_km2?.toFixed(1) ?? "—"} km² · permanente{" "}
                {resultAnalysis.change.persistent_area_km2?.toFixed(1) ?? "—"} km²
              </p>
            ) : (
              <p className="caption">
                Agua detectada {resultAnalysis.affected_area_km2?.toFixed(1) ?? "—"} km² (sin capa de
                cambio)
              </p>
            )}
            {resultAnalysis.bounds ? (
              <div className="map-layer-controls">
                <label className="field">
                  Capa
                  <select
                    value={resultLayer}
                    onChange={(e) => setResultLayer(e.target.value as ResultLayerId)}
                  >
                    <option value="change">Agua nueva</option>
                    <option value="mask">Máscara de agua</option>
                    <option value="preview">Vista previa</option>
                  </select>
                </label>
                <label className="field">
                  Opacidad {Math.round(opacity * 100)}%
                  <input
                    type="range"
                    min={0.15}
                    max={1}
                    step={0.05}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                  />
                </label>
              </div>
            ) : (
              <p className="caption catalog-error">
                Este resultado no trae bounds geográficos; ábrelo en Análisis para ver el lienzo.
              </p>
            )}
            <Link className="secondary wide map-panel-link" to={paths.analysis}>
              Ver detalle técnico
            </Link>
            <button type="button" className="secondary wide" onClick={clearAoi}>
              Nuevo análisis
            </button>
          </div>
        )}

        <footer className="map-panel-foot">
          <button
            type="button"
            className="advanced-toggle"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Ocultar" : "Más"} · guía y vista clásica
          </button>
          {showAdvanced && (
            <div className="caption">
              <p>
                Guía: <Link to={paths.howToUse}>How to use</Link>
              </p>
              <p>
                Coordenadas del centro:{" "}
                {confirmedAoi || draftAoi
                  ? formatPlaceCoords(aoiPlace((confirmedAoi ?? draftAoi)!))
                  : "—"}
              </p>
              <p className="muted">
                Distances/áreas del AOI usan aproximación plana (cos lat); el procesamiento usa el
                bbox WGS84 enviado.
              </p>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}

function ScenePicker({
  title,
  scenes,
  selectedId,
  onSelect,
  busy,
}: {
  title: string;
  scenes: RankedScene[] | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  busy: boolean;
}) {
  if (!scenes) return null;
  if (scenes.length === 0) {
    return (
      <div>
        <h3>{title}</h3>
        <p className="caption">Sin candidatas</p>
      </div>
    );
  }
  return (
    <div>
      <h3>
        {title} · {scenes.length}
      </h3>
      <ul className="catalog-list compare-scene-list map-compact-list">
        {scenes.slice(0, 8).map((s) => {
          const on = selectedId === s.id;
          return (
            <li key={s.id} className={on ? "is-selected" : undefined}>
              {s.thumbnail ? (
                <img className="catalog-thumb" src={s.thumbnail} alt="" loading="lazy" width={48} height={48} />
              ) : (
                <span className="catalog-thumb catalog-thumb-empty" aria-hidden />
              )}
              <div className="catalog-meta">
                <span className="num">{s.datetime.slice(0, 10)}</span>
                <span className="caption">
                  {s.cloud_cover.toFixed(0)}% · {Math.round(s.coverage * 100)}% área
                </span>
              </div>
              <button
                type="button"
                className={on ? "primary" : "secondary"}
                disabled={busy}
                onClick={() => onSelect(s.id)}
              >
                {on ? "Elegida" : "Elegir"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
