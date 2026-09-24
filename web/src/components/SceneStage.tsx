import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fmt } from "../lib/insights";
import { type Scene, useScene } from "../lib/scene";
import type { Analysis, TaskInfo } from "../types";

type View = "scene" | "classes";

interface Props {
  analysis: Analysis | null;
  tasks: TaskInfo[];
  busy: boolean;
}

export function SceneStage({ analysis, tasks, busy }: Props) {
  const { scene, error } = useScene(analysis);
  const [view, setView] = useState<View>("scene");
  const [paint, setPaint] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const size = useFit(box, scene ? scene.w / scene.h : 1, `${analysis?.id}-${busy}`);

  if (busy) {
    return (
      <main className="stage">
        <div className="placeholder scanning">
          <span>Prithvi recorre la escena en ventanas de 512 × 512</span>
        </div>
      </main>
    );
  }

  if (!analysis) {
    return (
      <main className="stage">
        <div className="placeholder">
          <span>Sube un GeoTIFF. Tune pinta cada píxel con la clase que predice el modelo.</span>
        </div>
      </main>
    );
  }

  const classes = tasks.find((t) => t.id === analysis.task)?.classes ?? ["Negativo", "Positivo"];

  return (
    <main className="stage">
      <div className="stage-bar">
        <span className="ellipsis" title={analysis.input_filename}>
          {analysis.input_filename}
        </span>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view === "scene"} onClick={() => setView("scene")}>
            Escena
          </button>
          <button type="button" role="tab" aria-selected={view === "classes"} onClick={() => setView("classes")}>
            Clases
          </button>
        </div>
      </div>

      <div className="stage-body" ref={box}>
        {error && <p className="muted">{error}</p>}
        {scene && size && (
          <figure className="plate" style={{ width: size.w + 44 }}>
            <Profile values={scene.cols} axis="x" mark={hover?.x} size={size.w} />
            <span />
            <Painting
              key={`${scene.id}-${view}`}
              scene={scene}
              mode={view}
              paint={paint}
              width={size.w}
              height={size.h}
              onHover={setHover}
            />
            <Profile values={scene.rows} axis="y" mark={hover?.y} size={size.h} />
          </figure>
        )}
      </div>

      <div className="stage-foot">
        <div className="legend">
          <span>
            <i className="swatch ink" />
            {classes[1]}
          </span>
          <span>
            <i className="swatch clear" />
            {classes[0]}
          </span>
          <span>
            <i className="swatch nodata" />
            Sin dato
          </span>
        </div>
        <label className="check">
          <input type="checkbox" checked={paint} onChange={(e) => setPaint(e.target.checked)} />
          Pintar
        </label>
        <Readout analysis={analysis} scene={scene} hover={hover} classes={classes} />
      </div>
    </main>
  );
}

function useFit(ref: React.RefObject<HTMLDivElement | null>, ratio: number, mountKey: string) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const availW = el.clientWidth - 88;
      const availH = el.clientHeight - 88;
      const w = Math.max(120, Math.min(availW, availH * ratio));
      setSize({ w: Math.floor(w), h: Math.floor(w / ratio) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, ratio, mountKey]);
  return size;
}

function Painting({
  scene,
  mode,
  paint,
  width,
  height,
  onHover,
}: {
  scene: Scene;
  mode: View;
  paint: boolean;
  width: number;
  height: number;
  onHover: (p: { x: number; y: number } | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const progress = useRef(0);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const draw = (p: number) => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, scene.w, scene.h);
      ctx.drawImage(mode === "scene" ? scene.base : scene.classes, 0, 0);
      if (paint) {
        const rows = Math.round(p * scene.h);
        if (rows > 0) {
          ctx.globalAlpha = mode === "scene" ? 0.62 : 1;
          ctx.drawImage(scene.overlay, 0, 0, scene.w, rows, 0, 0, scene.w, rows);
          ctx.globalAlpha = 1;
        }
        if (p < 1) {
          ctx.fillStyle = "#111111";
          ctx.fillRect(0, rows, scene.w, Math.max(1, scene.h / 256));
        }
      }
    };

    if (!paint) {
      progress.current = 0;
      draw(0);
      return;
    }
    if (progress.current >= 1 || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      progress.current = 1;
      draw(1);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 1400);
      progress.current = 1 - (1 - k) ** 3;
      draw(progress.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scene, mode, paint]);

  return (
    <canvas
      ref={ref}
      className="painting"
      width={scene.w}
      height={scene.h}
      style={{ width, height }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const x = Math.floor(((e.clientX - r.left) / r.width) * scene.w);
        const y = Math.floor(((e.clientY - r.top) / r.height) * scene.h);
        onHover(x >= 0 && y >= 0 && x < scene.w && y < scene.h ? { x, y } : null);
      }}
      onMouseLeave={() => onHover(null)}
    />
  );
}

function Profile({ values, axis, mark, size }: { values: Float32Array; axis: "x" | "y"; mark?: number; size: number }) {
  const n = values.length;
  const pts = Array.from(values, (v, i) => (axis === "x" ? `${i + 0.5},${1 - v}` : `${v},${i + 0.5}`)).join(" ");
  const area = axis === "x" ? `0,1 ${pts} ${n},1` : `0,0 ${pts} 0,${n}`;
  return (
    <svg
      className={`profile profile-${axis}`}
      viewBox={axis === "x" ? `0 0 ${n} 1` : `0 0 1 ${n}`}
      preserveAspectRatio="none"
      style={axis === "x" ? { width: size } : { height: size }}
      aria-label={axis === "x" ? "Fracción afectada por columna" : "Fracción afectada por fila"}
    >
      <polygon points={area} />
      <polyline points={pts} />
      {mark != null &&
        (axis === "x" ? (
          <line x1={mark + 0.5} x2={mark + 0.5} y1={0} y2={1} />
        ) : (
          <line x1={0} x2={1} y1={mark + 0.5} y2={mark + 0.5} />
        ))}
    </svg>
  );
}

function Readout({
  analysis: a,
  scene,
  hover,
  classes,
}: {
  analysis: Analysis;
  scene: Scene | null;
  hover: { x: number; y: number } | null;
  classes: string[];
}) {
  if (!scene || !hover) {
    return <span className="muted">{scene ? "Pasa el cursor sobre un píxel" : "Pintando…"}</span>;
  }
  const i = hover.y * scene.w + hover.x;
  const label = !scene.valid[i] ? "Sin dato" : scene.positive[i] ? classes[1] : classes[0];
  const px = Math.floor((hover.x * a.width) / scene.w);
  const py = Math.floor((hover.y * a.height) / scene.h);
  let where = "";
  if (a.bounds) {
    const lon = a.bounds.west + ((hover.x + 0.5) / scene.w) * (a.bounds.east - a.bounds.west);
    const lat = a.bounds.north - ((hover.y + 0.5) / scene.h) * (a.bounds.north - a.bounds.south);
    where = ` · ${fmt.coord(lat, "N", "S")}  ${fmt.coord(lon, "E", "W")}`;
  }
  return (
    <span className="num">
      <strong>{label}</strong>
      <span className="muted">
        {" "}
        · {px}, {py}
        {where}
      </span>
    </span>
  );
}
