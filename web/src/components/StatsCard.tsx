import { fmt, insights, severity, TASK_META } from "../lib/insights";
import type { Analysis, TaskInfo } from "../types";

interface Props {
  analysis: Analysis;
  tasks: TaskInfo[];
}

export function StatsCard({ analysis: a, tasks }: Props) {
  const info = tasks.find((t) => t.id === a.task);
  const meta = TASK_META[a.task];
  const ins = insights(a);
  const sev = severity(a.affected_ratio);
  const positive = info?.classes[1] ?? "Afectado";

  return (
    <section className="panel readout" style={{ "--accent": meta.accent } as React.CSSProperties}>
      <div className="readout-top">
        <span className="eyebrow">03 · Resultado</span>
        <span className="id">#{a.id}</span>
      </div>

      <div className="hero">
        <span className="hero-num">{fmt.pct(a.affected_ratio)}</span>
        <span className="hero-unit">%</span>
      </div>
      <div className="hero-sub">
        <span>{positive}</span>
        <span className={`sev sev-${sev.level}`}>{sev.label}</span>
      </div>

      <div className="sevbar" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i <= sev.level ? "lit" : ""} />
        ))}
        <i style={{ left: `${Math.min(a.affected_ratio, 1) * 100}%` }} />
      </div>

      <div className="split">
        <Split
          label={ins.areaEstimated ? `${positive} · estimada` : positive}
          km2={ins.affectedAreaKm2}
          px={a.affected_pixels}
          accent
        />
        <Split
          label={info?.classes[0] ?? "Sin afectación"}
          km2={ins.clearAreaKm2}
          px={a.valid_pixels - a.affected_pixels}
        />
      </div>

      <dl className="grid">
        <Cell k="Cobertura válida" v={`${fmt.pct(ins.coverage, 0)}%`} />
        <Cell k="Resolución" v={ins.gsdM ? `${ins.gsdM.toFixed(0)} m/px` : "—"} />
        <Cell k="Extensión" v={ins.extentKm ? `${ins.extentKm.w.toFixed(1)} × ${ins.extentKm.h.toFixed(1)} km` : `${a.width}×${a.height} px`} />
        <Cell k="Ventanas 512²" v={String(ins.windows)} />
        <Cell k="Latencia" v={fmt.secs(a.latency_s)} />
        <Cell k="Rendimiento" v={ins.throughputMpx ? `${ins.throughputMpx.toFixed(2)} Mpx/s` : "—"} />
      </dl>

      {(ins.scene.sensor || ins.scene.date || ins.scene.region) && (
        <dl className="scene">
          {ins.scene.region && <Row k="Región" v={ins.scene.region} />}
          {ins.scene.sensor && <Row k="Sensor" v={ins.scene.sensor} />}
          {ins.scene.tile && <Row k="Tile" v={ins.scene.tile} />}
          {ins.scene.date && <Row k="Adquisición" v={ins.scene.date} />}
          {ins.scene.source && <Row k="Origen" v={ins.scene.source} />}
        </dl>
      )}

      <dl className="scene">
        <Row k="CRS" v={ins.crsLabel} />
        {ins.center && (
          <Row
            k="Centro"
            v={`${fmt.coord(ins.center.lat, "N", "S")}  ${fmt.coord(ins.center.lon, "E", "W")}`}
          />
        )}
        <Row k="Modelo" v={a.model_id.split("/")[1]} mono />
      </dl>

      <div className="downloads">
        {a.artifacts.mask_tif && <a href={a.artifacts.mask_tif}>Máscara GeoTIFF</a>}
        <a href={a.artifacts.mask_png}>Máscara PNG</a>
        {a.artifacts.preview_png && <a href={a.artifacts.preview_png}>RGB</a>}
        <a href={`/api/analyses/${a.id}`} target="_blank" rel="noreferrer">
          JSON
        </a>
      </div>
    </section>
  );
}

function Split({ label, km2, px, accent }: { label: string; km2: number | null; px: number; accent?: boolean }) {
  return (
    <div className={`split-cell ${accent ? "accent" : ""}`}>
      <span className="k">{label}</span>
      <span className="v">
        {fmt.km2(km2)}
        <small> km²</small>
      </span>
      <span className="k num">{fmt.int(px)} px</span>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="row">
      <dt>{k}</dt>
      <dd className={mono ? "mono" : ""}>{v}</dd>
    </div>
  );
}
