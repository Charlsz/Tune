import { useState } from "react";
import { api } from "../api";
import type { CatalogScene, Place, TaskId } from "../types";

export function CatalogPanel({
  place,
  busy,
  onAnalyze,
}: {
  place: Place | null;
  busy: boolean;
  onAnalyze: (itemId: string, task: TaskId, place: Place, sideKm: number) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [start, setStart] = useState(monthAgo);
  const [end, setEnd] = useState(today);
  const [maxCloud, setMaxCloud] = useState(40);
  const [sideKm, setSideKm] = useState(20);
  const [scenes, setScenes] = useState<CatalogScene[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!place) {
      setError("Define primero una coordenada en Encontrar.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await api.catalogSearch({
        lat: place.lat,
        lon: place.lon,
        start,
        end,
        maxCloud,
        sideKm,
      });
      setScenes(items);
      if (items.length === 0) setError("Ninguna escena cumple el filtro.");
    } catch (err) {
      setError((err as Error).message);
      setScenes([]);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeRecent(n: number) {
    if (!place || !scenes?.length) return;
    const batch = scenes.slice(0, n);
    for (const scene of batch) {
      await onAnalyze(scene.id, "flood", place, sideKm);
    }
  }

  return (
    <form className="section" onSubmit={search}>
      <h3>Catálogo Sentinel-2</h3>
      <p className="caption">Busca escenas L2A por fecha alrededor del punto.</p>
      <label className="field">
        Desde
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label className="field">
        Hasta
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <label className="field">
        Nubes máx. %
        <input
          type="number"
          min={0}
          max={100}
          value={maxCloud}
          onChange={(e) => setMaxCloud(Number(e.target.value))}
        />
      </label>
      <label className="field">
        Lado km
        <input
          type="number"
          min={1}
          max={50}
          value={sideKm}
          onChange={(e) => setSideKm(Number(e.target.value))}
        />
      </label>
      <button className="primary" type="submit" disabled={busy || loading || !place}>
        {loading ? "Buscando…" : "Buscar escenas"}
      </button>
      {error && <p className="caption">{error}</p>}
      {scenes && scenes.length > 0 && (
        <ul className="catalog-list">
          {scenes.map((s) => (
            <li key={s.id}>
              <span className="num">{s.datetime.slice(0, 10)}</span>
              <span className="caption">{s.cloud_cover.toFixed(0)}% nubes</span>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => place && onAnalyze(s.id, "flood", place, sideKm)}
              >
                Analizar
              </button>
            </li>
          ))}
        </ul>
      )}
      {scenes && scenes.length > 1 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => analyzeRecent(Math.min(3, scenes.length))}
        >
          Analizar las {Math.min(3, scenes.length)} más recientes
        </button>
      )}
    </form>
  );
}
