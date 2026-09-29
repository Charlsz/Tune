import { fmt } from "../lib/insights";
import type { Analysis, RasterMetadata } from "../types";

export function MetadataCard({ analysis: a }: { analysis: Analysis }) {
  const m = "driver" in a.metadata ? (a.metadata as RasterMetadata) : null;
  if (!m) {
    return <p className="caption">Este análisis es anterior a la lectura de metadatos. Vuelve a analizar la escena para verlos.</p>;
  }
  const tags = Object.entries(m.tags);

  return (
    <div className="meta">
      <p className="caption">GeoTIFF · {m.band_count} bandas</p>
      <dl className="rows">
        <Row k="Sensor">{m.sensor ?? <span className="muted">Sin identificar</span>}</Row>
        <Row k="Resolución">
          {m.resolution_unit
            ? `${fmt.num(m.resolution[0])} × ${fmt.num(m.resolution[1])} ${m.resolution_unit}`
            : <span className="muted">Sin CRS</span>}
        </Row>
        <Row k="EPSG">{m.epsg ?? <span className="muted">—</span>}</Row>
        <Row k="Centro">
          {m.center ? `${fmt.coord(m.center.lat, "N", "S")}  ${fmt.coord(m.center.lon, "E", "W")}` : <span className="muted">—</span>}
        </Row>
        <Row k="Formato">
          {m.driver} · {m.dtype ?? "?"}
          {m.compression ? ` · ${m.compression}` : ""}
        </Row>
        <Row k="Nodata">{m.nodata ?? <span className="muted">No declarado</span>}</Row>
      </dl>

      <table className="bands num">
        <caption className="caption">Bandas sobre píxeles válidos. En negrita, las que entran al modelo.</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Descripción</th>
            <th scope="col">Mín</th>
            <th scope="col">Máx</th>
            <th scope="col">Media</th>
          </tr>
        </thead>
        <tbody>
          {m.bands.map((b) => (
            <tr key={b.index} className={b.used_by_model ? "used" : ""}>
              <td>{b.index}</td>
              <td className="ellipsis" title={[b.description, b.model_band].filter(Boolean).join(" · ")}>
                {b.description ?? b.model_band ?? <span className="muted">—</span>}
                {b.description && b.model_band && <span className="muted"> · {b.model_band}</span>}
              </td>
              <td>{fmt.num(b.min)}</td>
              <td>{fmt.num(b.max)}</td>
              <td>{fmt.num(b.mean)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {tags.length > 0 && (
        <details className="tags">
          <summary className="caption">Tags del archivo ({tags.length})</summary>
          <dl className="rows">
            {tags.map(([k, v]) => (
              <Row key={k} k={k}>
                <span className="ellipsis" title={v}>
                  {v}
                </span>
              </Row>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="row">
      <dt className="ellipsis" title={k}>
        {k}
      </dt>
      <dd className="num">{children}</dd>
    </div>
  );
}
