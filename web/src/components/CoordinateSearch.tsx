import { useState } from "react";
import type { Place } from "../types";

/** Puntos de arranque para la demo. No limitan el producto: cualquier lat/lon vale. */
const PRESETS: { label: string; place: Place; hint: string }[] = [
  { label: "Bogotá", place: { lat: 4.71, lon: -74.07 }, hint: "Andes" },
  { label: "Magdalena", place: { lat: 8.85, lon: -74.65 }, hint: "humedal" },
  { label: "Valencia (ES)", place: { lat: 39.47, lon: -0.38 }, hint: "Europa" },
  { label: "Sindh (PK)", place: { lat: 27.7, lon: 68.85 }, hint: "evento 2022" },
];

export function CoordinateSearch({
  place,
  onSearch,
  onClear,
}: {
  place: Place | null;
  onSearch: (place: Place) => void;
  onClear: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const match = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) {
      setError("Escribe latitud, longitud. Por ejemplo 4.71, -74.07");
      return;
    }
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError("La latitud va de -90 a 90 y la longitud de -180 a 180");
      return;
    }
    setError(null);
    onSearch({ lat, lon });
  }

  function pickPreset(p: (typeof PRESETS)[number]) {
    setText(`${p.place.lat}, ${p.place.lon}`);
    setError(null);
    onSearch(p.place);
  }

  return (
    <form className="section" onSubmit={submit}>
      <h3>Coordenada</h3>
      <p className="caption">Cualquier latitud y longitud. Los atajos son opcionales.</p>
      <div className="search">
        <input
          aria-label="Latitud y longitud"
          placeholder="4.71, -74.07"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="primary" type="submit">
          Buscar
        </button>
      </div>
      <div className="presets" role="group" aria-label="Ejemplos de coordenadas">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={
              place && place.lat === p.place.lat && place.lon === p.place.lon ? "on" : undefined
            }
            onClick={() => pickPreset(p)}
            title={p.hint}
          >
            {p.label}
          </button>
        ))}
      </div>
      {error && <p className="caption">{error}</p>}
      {place && (
        <p className="caption">
          <span className="num">
            {place.lat}, {place.lon}
          </span>
          <button
            type="button"
            className="close"
            onClick={() => {
              setText("");
              setError(null);
              onClear();
            }}
          >
            Quitar
          </button>
        </p>
      )}
    </form>
  );
}
