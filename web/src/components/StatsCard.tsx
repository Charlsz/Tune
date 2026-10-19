import { affectedKm2, crsLabel, fmt, TASK_META } from "../lib/insights";
import type { Analysis, Place, TaskInfo } from "../types";
import { MetadataCard } from "./MetadataCard";

interface Props {
  analysis: Analysis;
  tasks: TaskInfo[];
  onClose: () => void;
  compact?: boolean;
}

export function sceneCenter(a: Analysis): Place | null {
  if (!a.bounds) return null;
  const center = (a.metadata as { center?: Place }).center;
  if (center) return center;
  return {
    lat: (a.bounds.north + a.bounds.south) / 2,
    lon: (a.bounds.east + a.bounds.west) / 2,
  };
}

export function StatsCard({ analysis: a, tasks, onClose, compact = false }: Props) {
  const meta = TASK_META[a.task];
  const positive = tasks.find((t) => t.id === a.task)?.classes[1] ?? meta.name;
  const area = affectedKm2(a);
  const point = sceneCenter(a);
  const hasChange = a.change != null;
  const flood = a.task === "flood";
  const heroKm2 = hasChange ? a.change!.new_area_km2 : area.value;
  const heroEstimated = hasChange ? false : area.estimated;
  const heroLabel = hasChange
    ? flood
      ? "Posible inundación (agua nueva)"
      : "Área nueva"
    : `Área de ${positive}`;

  const permanentKm2 = a.change?.persistent_area_km2 ?? 0;
  const newEqualsDetected =
    hasChange &&
    flood &&
    area.value != null &&
    a.change!.new_area_km2 != null &&
    Math.abs(area.value - a.change!.new_area_km2) < 0.02 &&
    permanentKm2 < 0.02;

  const extSources =
    a.fusion?.sources.filter((s) => s !== "prithvi").join(", ") || "producto externo";

  return (
    <div className={`result${compact ? " result-compact" : ""}`}>
      <div className="result-head">
        <div>
          <p className="result-kicker">Resumen del análisis</p>
          <h3>{meta.name}</h3>
        </div>
        <button type="button" className="close" aria-label="Cerrar resultado" onClick={onClose}>
          Cerrar
        </button>
      </div>

      {heroKm2 != null ? (
        <>
          <div className="figure num">
            {heroEstimated && <span className="approx">≈</span>}
            {fmt.km2(heroKm2)}
            <span> km²</span>
          </div>
          <p className="caption">{heroLabel}</p>
        </>
      ) : (
        <>
          <div className="figure num">
            {fmt.pct(a.affected_ratio)}
            <span>%</span>
          </div>
          <p className="caption">de los píxeles válidos son «{positive}»</p>
        </>
      )}

      {a.exposure?.population_exposed != null && a.exposure.population_exposed > 0 && (
        <p className="metric-line">
          <span className="muted">Población expuesta (aprox.)</span>
          <strong className="num">{fmt.int(Math.round(a.exposure.population_exposed))}</strong>
        </p>
      )}
      {a.exposure?.population_exposed === 0 && (
        <p className="caption">Sin población estimada en este recorte.</p>
      )}

      {hasChange && flood && area.value != null && a.change!.new_area_km2 != null && (
        <div className="compare-strip">
          <div>
            <span className="muted">Agua detectada</span>
            <strong className="num">{fmt.km2(area.value)} km²</strong>
          </div>
          <div>
            <span className="muted">Posible inundación</span>
            <strong className="num">{fmt.km2(a.change!.new_area_km2)} km²</strong>
          </div>
        </div>
      )}

      {hasChange && flood && (
        <p className={`callout${newEqualsDetected ? " warn" : ""}`}>
          {newEqualsDetected ? (
            <>
              Las dos cifras coinciden porque la referencia no halló agua permanente:{" "}
              <strong>toda el agua del modelo se cuenta como inundación (agua nueva)</strong>. En el
              mapa verás la misma zona en ambas capas; el color cambia, no el contorno.
            </>
          ) : (
            <>
              La cifra grande es <strong>posible inundación = agua nueva</strong> (detectada menos
              permanente). Es un subconjunto del agua del modelo (
              {fmt.pct(a.affected_ratio)}% de píxeles).
            </>
          )}
        </p>
      )}

      {!hasChange && flood && (
        <p className="callout warn">
          No hay referencia histórica de agua permanente para esta escena. Se muestra el agua
          detectada por el modelo, no una estimación de inundación.
        </p>
      )}

      <details className="detail" open={!compact}>
        <summary>Ver detalles</summary>
        <div className="detail-body">
          <h4 className="caption strategy">Qué midió el modelo</h4>
          <dl className="rows">
            <Row k={flood ? "Agua detectada (modelo)" : "Área afectada"}>
              {area.value == null ? (
                <span className="muted">Sin CRS</span>
              ) : (
                <>
                  {area.estimated && "aprox. "}
                  {fmt.km2(area.value)} km²
                </>
              )}
            </Row>
            <Row k="Píxeles positivos">
              {fmt.int(a.affected_pixels)}{" "}
              <span className="muted">de {fmt.int(a.valid_pixels)}</span>
            </Row>
          </dl>

          {hasChange && (
            <>
              <h4 className="caption strategy">
                {flood ? "Inundación frente a referencia" : "Cambio frente a referencia"} (
                {a.change!.reference_source})
              </h4>
              <dl className="rows">
                <Row k={flood ? "Agua nueva (= inundación)" : "Área nueva"}>
                  {a.change!.new_area_km2 == null ? (
                    <span className="muted">{fmt.int(a.change!.new_pixels)} px</span>
                  ) : (
                    <>{fmt.km2(a.change!.new_area_km2)} km²</>
                  )}
                </Row>
                <Row k={flood ? "Agua permanente" : "Permanente"}>
                  {a.change!.persistent_area_km2 == null ? (
                    <span className="muted">{fmt.int(a.change!.persistent_pixels)} px</span>
                  ) : (
                    <>{fmt.km2(a.change!.persistent_area_km2)} km²</>
                  )}
                </Row>
                <Row k="Retirada">
                  {a.change!.receded_area_km2 == null ? (
                    <span className="muted">{fmt.int(a.change!.receded_pixels)} px</span>
                  ) : (
                    <>{fmt.km2(a.change!.receded_area_km2)} km²</>
                  )}
                </Row>
              </dl>
            </>
          )}

          <dl className="rows">
            <Row k="Ubicación">
              {point ? (
                <span className="where">
                  <span>
                    {point.lat.toFixed(4)}, {point.lon.toFixed(4)}
                  </span>
                  <a
                    className="map-btn"
                    href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lon}#map=12/${point.lat}/${point.lon}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    OpenStreetMap
                  </a>
                </span>
              ) : (
                <span className="muted">No se puede ubicar</span>
              )}
            </Row>
          </dl>

          {a.fusion && (
            <>
              <h4 className="caption strategy">Comparación con {extSources}</h4>
              <dl className="rows">
                <Row k="IoU">{a.fusion.iou == null ? "n/d" : a.fusion.iou.toFixed(2)}</Row>
                <Row k="Acuerdo">
                  {a.fusion.agree_area_km2 == null
                    ? `${fmt.int(a.fusion.agree_pixels)} px`
                    : `${fmt.km2(a.fusion.agree_area_km2)} km²`}
                </Row>
                <Row k="Solo Tune">
                  {a.fusion.tune_only_area_km2 == null
                    ? `${fmt.int(a.fusion.tune_only_pixels)} px`
                    : `${fmt.km2(a.fusion.tune_only_area_km2)} km²`}
                </Row>
                <Row k="Solo externo">
                  {a.fusion.external_only_area_km2 == null
                    ? `${fmt.int(a.fusion.external_only_pixels)} px`
                    : `${fmt.km2(a.fusion.external_only_area_km2)} km²`}
                </Row>
              </dl>
              {a.fusion.iou == null && a.fusion.agree_pixels === 0 && (
                <p className="caption">
                  No hubo capa externa alineada para esta escena; la comparación queda vacía.
                </p>
              )}
            </>
          )}

          {a.exposure && (
            <>
              <h4 className="caption strategy">Exposición ({a.exposure.landcover_source})</h4>
              <dl className="rows">
                <Row k="Población">
                  {a.exposure.population_exposed == null
                    ? "sin dato"
                    : fmt.int(Math.round(a.exposure.population_exposed))}
                </Row>
                {a.exposure.classes.slice(0, 4).map((c) => (
                  <Row key={c.code} k={c.label}>
                    {c.area_km2 == null ? `${fmt.int(c.pixels)} px` : `${fmt.km2(c.area_km2)} km²`}
                    <span className="muted"> {fmt.pct(c.fraction)}%</span>
                  </Row>
                ))}
              </dl>
            </>
          )}
        </div>
      </details>

      <details className="detail">
        <summary>Detalles técnicos</summary>
        <div className="detail-body">
          <dl className="rows">
            <Row k="Adquisición">
              {a.acquired_at ? fmt.day(a.acquired_at) : <span className="muted">Desconocida</span>}
            </Row>
            <Row k="Tamaño">
              {a.width} × {a.height} px
            </Row>
            <Row k="CRS">{crsLabel(a.crs)}</Row>
            <Row k="Modelo">
              <a
                className="ellipsis"
                href={`https://huggingface.co/${a.model_id}`}
                target="_blank"
                rel="noreferrer"
                title={a.model_id}
              >
                {a.model_id.split("/")[1]}
              </a>
            </Row>
            <Row k="Dataset">{meta.dataset}</Row>
            <Row k="Latencia">{fmt.secs(a.latency_s)}</Row>
            <Row k="Análisis">{fmt.ago(a.created_at)}</Row>
          </dl>
          <p className="downloads">
            <span className="muted">Descargar</span>
            {a.artifacts.mask_tif && <a href={a.artifacts.mask_tif}>GeoTIFF</a>}
            <a href={a.artifacts.mask_png}>PNG</a>
            {a.artifacts.change_png && <a href={a.artifacts.change_png}>Cambio</a>}
            {a.artifacts.fusion_png && <a href={a.artifacts.fusion_png}>Acuerdo</a>}
            {a.artifacts.preview_png && <a href={a.artifacts.preview_png}>RGB</a>}
            <a href={`/api/analyses/${a.id}`} target="_blank" rel="noreferrer">
              JSON
            </a>
          </p>
          <MetadataCard analysis={a} />
        </div>
      </details>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="row">
      <dt>{k}</dt>
      <dd className="num">{children}</dd>
    </div>
  );
}
