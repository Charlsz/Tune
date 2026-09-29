import { useState } from "react";
import type { Place } from "../types";

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

  return (
    <form className="section" onSubmit={submit}>
      <h2>Buscar por coordenada</h2>
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
      {error && <p className="caption">{error}</p>}
      {place && (
        <p className="caption">
          <span className="num">
            {place.lat}, {place.lon}
          </span>
          <button type="button" className="close" onClick={onClear}>
            Quitar
          </button>
        </p>
      )}
    </form>
  );
}
