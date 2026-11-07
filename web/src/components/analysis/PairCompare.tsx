import { useEffect, useRef, useState } from "react";
import { analysisDate } from "../../lib/pair";
import { fmt } from "../../lib/insights";
import { useScene } from "../../lib/scene";
import { useFit } from "../../lib/useFit";
import type { Analysis } from "../../types";

type PanelMode = "overlay" | "change" | "scene";

function Panel({
  analysis,
  role,
  mode,
}: {
  analysis: Analysis;
  role: "Antes" | "Después";
  mode: PanelMode;
}) {
  const { scene, error } = useScene(analysis);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const day = analysisDate(analysis);
  const size = useFit(
    frameRef,
    scene ? scene.w / scene.h : 1,
    `${analysis.id}-${mode}-${scene?.w ?? 0}`,
    8,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene) return;
    const src =
      mode === "change" && scene.change
        ? scene.change
        : mode === "scene"
          ? scene.base
          : scene.overlay;
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0);
  }, [scene, mode]);

  return (
    <article className="pair-panel">
      <header className="pair-panel-head">
        <h3>{role}</h3>
        <p className="caption">
          {day ? <span className="num">{fmt.day(day)}</span> : "Sin fecha de adquisición"}
          {analysis.affected_area_km2 != null && (
            <>
              {" "}
              · agua {fmt.km2(analysis.affected_area_km2)} km²
            </>
          )}
        </p>
      </header>
      {error && <p className="caption catalog-error">{error}</p>}
      {!scene && !error && <p className="caption">Cargando escena…</p>}
      <div className="pair-frame" ref={frameRef}>
        <canvas
          ref={canvasRef}
          className="pair-canvas"
          style={size ? { width: size.w, height: size.h } : undefined}
        />
      </div>
    </article>
  );
}

/**
 * Vista lado a lado: deja ver el cambio temporal que define inundación
 * (agua nueva frente a la línea base), alineado con el Segundo Informe.
 */
export function PairCompare({
  before,
  after,
  onSelectSingle,
  onClosePair,
}: {
  before: Analysis;
  after: Analysis;
  onSelectSingle: (a: Analysis) => void;
  onClosePair: () => void;
}) {
  const [mode, setMode] = useState<PanelMode>("overlay");
  const ch = after.change;
  const afterDay = analysisDate(after);
  const beforeDay = analysisDate(before);

  return (
    <section className="pair-compare" aria-label="Comparación Antes y Después">
      <div className="pair-toolbar">
        <div>
          <p className="result-kicker">Comparación temporal</p>
          <h2 className="pair-title">
            Antes {beforeDay ? <span className="num">{beforeDay}</span> : null}
            <span className="pair-title-sep">→</span>
            Después {afterDay ? <span className="num">{afterDay}</span> : null}
          </h2>
          <p className="caption pair-lead">
            Inundación = agua que aparece en Después y no estaba en la línea base. Rojo = agua
            nueva · azul = permanente.
          </p>
        </div>
        <div className="pair-actions">
          <div className="pair-modes" role="group" aria-label="Capas del par">
            {(
              [
                ["overlay", "Satélite + máscara"],
                ["change", "Cambio (inundación)"],
                ["scene", "Solo satélite"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={mode === id ? "on" : undefined}
                disabled={id === "change" && !after.artifacts.change_png}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="secondary" onClick={onClosePair}>
            Ver una sola escena
          </button>
        </div>
      </div>

      <div className="pair-grid">
        <Panel analysis={before} role="Antes" mode={mode === "change" ? "overlay" : mode} />
        <Panel analysis={after} role="Después" mode={mode} />
      </div>

      {ch && (
        <div className="pair-metrics" aria-label="Cifras de inundación">
          <div>
            <span className="muted">Agua detectada (Después)</span>
            <strong className="num">
              {after.affected_area_km2 != null ? `${fmt.km2(after.affected_area_km2)} km²` : "—"}
            </strong>
          </div>
          <div>
            <span className="muted">Posible inundación (nueva)</span>
            <strong className="num">
              {ch.new_area_km2 != null ? `${fmt.km2(ch.new_area_km2)} km²` : "—"}
            </strong>
          </div>
          <div>
            <span className="muted">Permanente</span>
            <strong className="num">
              {ch.persistent_area_km2 != null ? `${fmt.km2(ch.persistent_area_km2)} km²` : "—"}
            </strong>
          </div>
          <div>
            <span className="muted">Referencia</span>
            <strong>{ch.reference_source}</strong>
          </div>
        </div>
      )}

      <p className="caption pair-foot">
        Abrir detalle:{" "}
        <button type="button" className="linkish" onClick={() => onSelectSingle(before)}>
          Antes
        </button>
        {" · "}
        <button type="button" className="linkish" onClick={() => onSelectSingle(after)}>
          Después
        </button>
      </p>
    </section>
  );
}
